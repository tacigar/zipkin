/*
 * Copyright 2015-2018 The OpenZipkin Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */
package zipkin2.internal;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Queue;
import java.util.logging.Logger;

import static java.lang.String.format;
import static java.util.logging.Level.FINE;

/**
 * Convenience type representing a tree. This is here because multiple facets in zipkin require
 * traversing the trace tree. For example, looking at network boundaries to correct clock skew, or
 * counting requests imply visiting the tree.
 *
 * @param <V> the node's value. Ex a full span or a tuple like {@code (serviceName, isLocal)}
 */
public final class Node<V> {
  /** Set via {@link #addChild(Node)} */
  Node<V> parent;
  V value;
  /** mutable to avoid allocating lists for childless nodes */
  List<Node<V>> children = Collections.emptyList();

  Node(@Nullable V value) {
    this.value = value;
  }

  /** Returns the parent, or null if root */
  @Nullable public Node<V> parent() {
    return parent;
  }

  /** Returns the value, or null if a synthetic root node */
  @Nullable public V value() {
    return value;
  }

  /** Mutable as some transformations, such as clock skew, adjust the current node in the tree. */
  public Node<V> setValue(V newValue) {
    if (newValue == null) throw new NullPointerException("newValue == null");
    this.value = newValue;
    return this;
  }

  /** Adds the child IFF it isn't already a child. */
  public Node<V> addChild(Node<V> child) {
    if (child == this) throw new IllegalArgumentException("circular dependency on " + this);
    if (children.equals(Collections.emptyList())) children = new ArrayList<>();
    if (!children.contains(child)) children.add(child);
    child.parent = this;
    return this;
  }

  /** Returns the children of this node. */
  public List<Node<V>> children() {
    return children;
  }

  /** Traverses the tree, breadth-first. */
  public Iterator<Node<V>> traverse() {
    return new BreadthFirstIterator<>(this);
  }

  static final class BreadthFirstIterator<V> implements Iterator<Node<V>> {
    private final Queue<Node<V>> queue = new ArrayDeque<>();

    BreadthFirstIterator(Node<V> root) {
      queue.add(root);
    }

    @Override
    public boolean hasNext() {
      return !queue.isEmpty();
    }

    @Override
    public Node<V> next() {
      if (!hasNext()) throw new NoSuchElementException();
      Node<V> result = queue.remove();
      queue.addAll(result.children);
      return result;
    }

    @Override
    public void remove() {
      throw new UnsupportedOperationException("remove");
    }
  }

  /**
   * Some operations do not require the entire span object. This creates a tree given (parent id,
   * id) pairs.
   *
   * @param <V> same type as {@link Node#value}
   */
  public static final class TreeBuilder<V> {
    final Logger logger;
    final String traceId;

    public TreeBuilder(Logger logger, String traceId) {
      this.logger = logger;
      this.traceId = traceId;
    }

    Key rootKey = null;
    Node<V> rootNode = null;
    List<Entry<V>> entries = new ArrayList<>();
    // Nodes representing the trace tree
    Map<Key, Node<V>> keyToNode = new LinkedHashMap<>();
    // Collect the parent-child relationships between all spans.
    Map<Key, Key> keyToParent = new LinkedHashMap<>();

    /**
     * This is a variant of a normal parent/child graph specialized for Zipkin. In a Zipkin tree, a
     * parent and child can share the same ID if in an RPC. This variant treats a {@code shared}
     * node as a child of any node matching the same ID.
     *
     * @return false after logging to FINE if the value couldn't be added
     */
    public boolean addNode(@Nullable String parentId, String id, @Nullable Boolean shared,
      @Nullable Object qualifier, V value) {
      if (id.equals(parentId)) {
        if (logger.isLoggable(FINE)) {
          logger.fine(format("skipping circular dependency: traceId=%s, spanId=%s", traceId, id));
        }
        return false;
      }
      boolean sharedV = Boolean.TRUE.equals(shared);

      // Assume first that we want to link to the same qualifier. We will post-process later if this
      // is incorrect.
      Key idKey = new Key(id, sharedV, null);
      Key parentKey = null;
      if (sharedV) { // assume the parent might be on another host
        parentKey = new Key(id, false, null);
        keyToParent.put(new Key(id, sharedV, qualifier), parentKey);
      } else if (parentId != null) {
        parentKey = new Key(parentId, false, null);
      }

      keyToParent.put(idKey, parentKey);
      entries.add(new Entry<>(parentId, id, sharedV, qualifier, value));
      return true;
    }

    /**
     * When processing nodes, we index them by their ID, whether that ID is shared, and a qualifier
     * such as endpoint. This is important because in zipkin (specifically B3), a server can share
     * (re-use) the same ID as its client. Any child of that server span should link to the same
     * endpoint. If we didn't index by qualifier, descendants of multiple servers responding to the
     * same client would be placed incorrectly in the tree.
     *
     * <p>Note: this only works as the "id to parent" map is populated for all entries prior to this
     * stage.
     */
    void processNode(Entry<V> entry) {
      Key key = new Key(entry.id, entry.shared, entry.qualifier);
      Key unqualifiedKey = new Key(entry.id, entry.shared, null);
      V value = entry.value;

      Key parentKey = null;
      if (key.shared) {
        // For example, this is a server span. It will very likely be on a different endpoint than
        // the client. So we want to pick the first node that has the same ID and is not shared
        // (clients never know if they can be shared).
        parentKey = new Key(entry.id, false, null);
      } else if (entry.parentId != null) {
        // We are not a root span, and not a shared server span. Proceed in most specific to least.

        // We could be the child of a shared server span (ex a local (intermediate) span on the same
        // endpoint). This is the most specific case, so we try this first.
        parentKey = new Key(entry.parentId, true, entry.qualifier);
        if (keyToParent.containsKey(parentKey)) {
          keyToParent.put(unqualifiedKey, parentKey);
        } else {
          // Next, prefer the same host in case data was incorrectly send w/o a shared qualifier
          parentKey = new Key(entry.parentId, false, entry.qualifier);
          if (keyToParent.containsKey(parentKey)) {
            // non-shared spans lookup unqualified. Make sure any descendants of the current entry
            // can find their parent.
            keyToParent.put(unqualifiedKey, parentKey);
          }
          // At this point, we know our own parent is a normal span, so index it without a qualifier
          parentKey = new Key(entry.parentId, false, null);
        }
      } else { // we are root or don't know our parent
        if (rootKey != null) {
          if (logger.isLoggable(FINE)) {
            logger.fine(format(
              "attributing span missing parent to root: traceId=%s, rootSpanId=%s, spanId=%s",
              traceId, rootKey.id, key.id));
          }
        } else {
          rootKey = key;
        }
      }

      Node<V> node = new Node<>(value);
      // special-case root, and attribute missing parents to it. In
      // other words, assume that the first root is the "real" root.
      if (parentKey == null && rootNode == null) {
        rootNode = node;
        rootKey = key;
        keyToParent.remove(unqualifiedKey);
      } else if (key.shared) {
        // in the case of shared server span, we need to address it both ways
        // TODO: adrian document why
        keyToNode.put(key, node);
        keyToNode.put(unqualifiedKey, node);
      } else {
        keyToNode.put(unqualifiedKey, node);
      }
    }

    /** Builds a tree from calls to {@link #addNode}, or returns an empty tree. */
    public Node<V> build() {
      for (int i = 0, length = entries.size(); i < length; i++) {
        processNode(entries.get(i));
      }

      if (rootNode == null) {
        if (logger.isLoggable(FINE)) {
          logger.fine("substituting dummy node for missing root span: traceId=" + traceId);
        }
        rootNode = new Node<>(null);
      }

      // Materialize the tree using parent - child relationships
      for (Map.Entry<Key, Key> entry : keyToParent.entrySet()) {
        Node<V> node = keyToNode.get(entry.getKey());
        Node<V> parent = keyToNode.get(entry.getValue());
        if (parent == null) { // handle headless
          rootNode.addChild(node);
        } else {
          parent.addChild(node);
        }
      }
      return rootNode;
    }
  }

  /**
   * A node in the tree is not always unique on ID. Sharing is allowed once per ID (Ex: in RPC).
   * However, it is possible in a retry scenario for accidental duplicate ID sharing to occur
   */
  static final class Key {
    final String id;
    boolean shared;
    @Nullable final Object qualifier;

    Key(String id, boolean shared, @Nullable Object qualifier) {
      if (id == null) throw new NullPointerException("id == null");
      this.id = id;
      this.shared = shared;
      this.qualifier = qualifier;
    }

    @Override public String toString() {
      return "Key{id=" + id + ", shared=" + shared + ", qualifier=" + qualifier + "}";
    }

    @Override public boolean equals(Object o) {
      if (o == this) return true;
      if (!(o instanceof Key)) return false;
      Key that = (Key) o;
      return id.equals(that.id) && shared == that.shared && equal(qualifier, that.qualifier);
    }

    static boolean equal(Object a, Object b) {
      return a == b || (a != null && a.equals(b));
    }

    @Override public int hashCode() {
      int result = 1;
      result *= 1000003;
      result ^= id.hashCode();
      result *= 1000003;
      result ^= shared ? 1231 : 1237;
      result *= 1000003;
      result ^= (qualifier == null) ? 0 : qualifier.hashCode();
      return result;
    }
  }

  static final class Entry<V> {
    @Nullable final String parentId;
    final String id;
    final boolean shared;
    @Nullable final Object qualifier;
    final V value;

    Entry(@Nullable String parentId, String id, boolean shared, @Nullable Object qualifier,
      V value) {
      if (id == null) throw new NullPointerException("id == null");
      if (value == null) throw new NullPointerException("value == null");
      this.parentId = parentId;
      this.id = id;
      this.shared = shared;
      this.qualifier = qualifier;
      this.value = value;
    }

    @Override public String toString() {
      return "Entry{parentId="
        + parentId
        + ", id="
        + id
        + ", shared="
        + shared
        + ", qualifier="
        + qualifier
        + ", value="
        + value
        + "}";
    }
  }

  @Override public String toString() {
    List<V> childrenValues = new ArrayList<>();
    for (int i = 0, length = children.size(); i < length; i++) {
      childrenValues.add(children.get(i).value);
    }
    return "Node{parent=" + (parent != null ? parent.value : null)
      + ", value=" + value + ", children=" + childrenValues + "}";
  }
}
