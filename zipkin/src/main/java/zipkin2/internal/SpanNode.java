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
import zipkin2.Endpoint;
import zipkin2.Span;

import static java.lang.String.format;
import static java.util.logging.Level.FINE;

/**
 * Convenience type representing a trace tree. Multiple Zipkin features require a trace tree. For
 * example, looking at network boundaries to correct clock skew and aggregating requests paths imply
 * visiting the tree.
 */
public final class SpanNode {
  /** Set via {@link #addChild(SpanNode)} */
  SpanNode parent;
  Span span;
  /** mutable to avoid allocating lists for childless nodes */
  List<SpanNode> children = Collections.emptyList();

  SpanNode(@Nullable Span span) {
    this.span = span;
  }

  /** Returns the parent, or null if root */
  @Nullable public SpanNode parent() {
    return parent;
  }

  /** Returns the span, or null if a synthetic root span */
  @Nullable public Span span() {
    return span;
  }

  /** Mutable as some transformations, such as clock skew, adjust the current span in the tree. */
  public SpanNode span(Span newSpan) {
    if (newSpan == null) throw new NullPointerException("newSpan == null");
    this.span = newSpan;
    return this;
  }

  /** Adds the child IFF it isn't already a child. */
  public SpanNode addChild(SpanNode child) {
    if (child == null) throw new NullPointerException("child == null");
    if (child == this) throw new IllegalArgumentException("circular dependency on " + this);
    if (children.equals(Collections.emptyList())) children = new ArrayList<>();
    if (!children.contains(child)) children.add(child);
    child.parent = this;
    return this;
  }

  /** Returns the children of this node. */
  public List<SpanNode> children() {
    return children;
  }

  /** Traverses the tree, breadth-first. */
  public Iterator<SpanNode> traverse() {
    return new BreadthFirstIterator(this);
  }

  static final class BreadthFirstIterator implements Iterator<SpanNode> {
    private final Queue<SpanNode> queue = new ArrayDeque<>();

    BreadthFirstIterator(SpanNode root) {
      queue.add(root);
    }

    @Override
    public boolean hasNext() {
      return !queue.isEmpty();
    }

    @Override
    public SpanNode next() {
      if (!hasNext()) throw new NoSuchElementException();
      SpanNode result = queue.remove();
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
   */
  public static final class TreeBuilder {
    final Logger logger;
    final String traceId;

    public TreeBuilder(Logger logger, String traceId) {
      this.logger = logger;
      this.traceId = traceId;
    }

    Key rootKey = null;
    SpanNode rootNode = null;
    List<Entry> entries = new ArrayList<>();
    // Nodes representing the trace tree
    Map<Key, SpanNode> keyToNode = new LinkedHashMap<>();
    // Collect the parent-child relationships between all spans.
    Map<Key, Key> keyToParent = new LinkedHashMap<>();

    /**
     * In a Zipkin trace, a parent and child can share the same ID if in an RPC. This variant treats
     * a {@code shared} span as a child of any span matching the same ID.
     *
     * @return false after logging to FINE if the span couldn't be added
     */
    public boolean addNode(Span span) {
      String id = span.id();
      if (id.equals(span.parentId())) {
        if (logger.isLoggable(FINE)) {
          logger.fine(format("skipping circular dependency: traceId=%s, spanId=%s", traceId, id));
        }
        return false;
      }
      boolean sharedV = Boolean.TRUE.equals(span.shared());
      Endpoint endpoint = span.localEndpoint();

      // Assume first that we want to link to the same endpoint. We will post-process later if this
      // is incorrect.
      Key idKey = new Key(id, sharedV, null);
      Key parentKey = null;
      if (sharedV) { // assume the parent might be on another host
        parentKey = new Key(id, false, null);
        keyToParent.put(new Key(id, sharedV, endpoint), parentKey);
      } else if (span.parentId() != null) {
        parentKey = new Key(span.parentId(), false, null);
      }

      keyToParent.put(idKey, parentKey);
      entries.add(new Entry(span.parentId(), id, sharedV, endpoint, span));
      return true;
    }

    /**
     * When processing nodes, we index them by their ID, whether that ID is shared, and a endpoint
     * such as endpoint. This is important because in zipkin (specifically B3), a server can share
     * (re-use) the same ID as its client. Any child of that server span should link to the same
     * endpoint. If we didn't index by endpoint, descendants of multiple servers responding to the
     * same client would be placed incorrectly in the tree.
     *
     * <p>Note: this only works as the "id to parent" map is populated for all entries prior to
     * this stage.
     */
    void processNode(Entry entry) {
      Key key = new Key(entry.id, entry.shared, entry.endpoint);
      Key noEndpointKey = new Key(entry.id, entry.shared, null);

      Key parentKey = null;
      if (key.shared) {
        // For example, this is a server span. It will very likely be on a different endpoint than
        // the client. So we want to pick the first span that has the same ID and is not shared
        // (clients never know if they can be shared).
        parentKey = new Key(entry.id, false, null);
      } else if (entry.parentId != null) {
        // We are not a root span, and not a shared server span. Proceed in most specific to least.

        // We could be the child of a shared server span (ex a local (intermediate) span on the same
        // endpoint). This is the most specific case, so we try this first.
        parentKey = new Key(entry.parentId, true, entry.endpoint);
        if (keyToParent.containsKey(parentKey)) {
          keyToParent.put(noEndpointKey, parentKey);
        } else {
          // Next, prefer the same host in case data was incorrectly send w/o a shared endpoint
          parentKey = new Key(entry.parentId, false, entry.endpoint);
          if (keyToParent.containsKey(parentKey)) {
            // non-shared spans lookup noEndpoint. Make sure any descendants of the current entry
            // can find their parent.
            keyToParent.put(noEndpointKey, parentKey);
          }
          // At this point, we know our own parent is a normal span, so index it without a endpoint
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

      SpanNode node = new SpanNode(entry.span);
      // special-case root, and attribute missing parents to it. In
      // other words, assume that the first root is the "real" root.
      if (parentKey == null && rootNode == null) {
        rootNode = node;
        rootKey = key;
        keyToParent.remove(noEndpointKey);
      } else if (key.shared) {
        // in the case of shared server span, we need to address it both ways
        // TODO: adrian document why
        keyToNode.put(key, node);
        keyToNode.put(noEndpointKey, node);
      } else {
        keyToNode.put(noEndpointKey, node);
      }
    }

    /** Builds a tree from calls to {@link #addNode}, or returns an empty tree. */
    public SpanNode build() {
      for (int i = 0, length = entries.size(); i < length; i++) {
        processNode(entries.get(i));
      }

      if (rootNode == null) {
        if (logger.isLoggable(FINE)) {
          logger.fine("substituting dummy node for missing root span: traceId=" + traceId);
        }
        rootNode = new SpanNode(null);
      }

      // Materialize the tree using parent - child relationships
      for (Map.Entry<Key, Key> entry : keyToParent.entrySet()) {
        SpanNode node = keyToNode.get(entry.getKey());
        SpanNode parent = keyToNode.get(entry.getValue());
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
   * A span in the tree is not always unique on ID. Sharing is allowed once per ID (Ex: in RPC).
   * However, it is possible in a retry scenario for accidental duplicate ID sharing to occur
   */
  static final class Key {
    final String id;
    boolean shared;
    @Nullable final Endpoint endpoint;

    Key(String id, boolean shared, @Nullable Endpoint endpoint) {
      if (id == null) throw new NullPointerException("id == null");
      this.id = id;
      this.shared = shared;
      this.endpoint = endpoint;
    }

    @Override public String toString() {
      return "Key{id=" + id + ", shared=" + shared + ", endpoint=" + endpoint + "}";
    }

    @Override public boolean equals(Object o) {
      if (o == this) return true;
      if (!(o instanceof Key)) return false;
      Key that = (Key) o;
      return id.equals(that.id) && shared == that.shared && equal(endpoint, that.endpoint);
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
      result ^= (endpoint == null) ? 0 : endpoint.hashCode();
      return result;
    }
  }

  static final class Entry {
    @Nullable final String parentId;
    final String id;
    final boolean shared;
    @Nullable final Endpoint endpoint;
    final Span span;

    Entry(@Nullable String parentId, String id, boolean shared, @Nullable Endpoint endpoint,
      Span span) {
      if (id == null) throw new NullPointerException("id == null");
      if (span == null) throw new NullPointerException("span == null");
      this.parentId = parentId;
      this.id = id;
      this.shared = shared;
      this.endpoint = endpoint;
      this.span = span;
    }

    @Override public String toString() {
      return "Entry{parentId="
        + parentId
        + ", id="
        + id
        + ", shared="
        + shared
        + ", endpoint="
        + endpoint
        + ", span="
        + span
        + "}";
    }
  }

  @Override public String toString() {
    List childrenSpans = new ArrayList();
    for (int i = 0, length = children.size(); i < length; i++) {
      childrenSpans.add(children.get(i).span);
    }
    return "SpanNode{parent=" + (parent != null ? parent.span : null)
      + ", span=" + span + ", children=" + childrenSpans + "}";
  }
}
