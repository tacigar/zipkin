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
  public SpanNode span(Span span) {
    if (span == null) throw new NullPointerException("span == null");
    this.span = span;
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

    @Override public boolean hasNext() {
      return !queue.isEmpty();
    }

    @Override public SpanNode next() {
      if (!hasNext()) throw new NoSuchElementException();
      SpanNode result = queue.remove();
      queue.addAll(result.children);
      return result;
    }

    @Override public void remove() {
      throw new UnsupportedOperationException("remove");
    }
  }

  /** Adds the child IFF it isn't already a child. */
  SpanNode addChild(SpanNode child) {
    if (child == null) throw new NullPointerException("child == null");
    if (child == this) throw new IllegalArgumentException("circular dependency on " + this);
    if (children.equals(Collections.emptyList())) children = new ArrayList<>();
    if (!children.contains(child)) children.add(child);
    child.parent = this;
    return this;
  }

  public static final class Builder {
    final Logger logger;

    Builder(Logger logger) {
      this.logger = logger;
    }

    SpanNode rootNode = null;
    Map<Key, SpanNode> keyToNode = new LinkedHashMap<>();
    Map<Key, Key> keyToParent = new LinkedHashMap<>();

    /**
     * Builds a trace tree by merging and processing the input or returns an empty tree.
     *
     * <p>While the input can be incomplete or redundant, they must all be a part of the same trace
     * (e.g. all share the same {@link Span#traceId()}).
     */
    public SpanNode build(List<Span> spans) {
      if (spans.isEmpty()) throw new IllegalArgumentException("spans were empty");

      // In order to make a tree, we need clean data. This will merge any duplicates so that we
      // don't have redundant leaves on the tree.
      List<Span> cleaned = Trace.merge(spans);
      String traceId = cleaned.get(0).traceId();

      if (logger.isLoggable(FINE)) logger.fine("building trace tree: traceId=" + traceId);

      // Next, index all the spans so that we can understand any relationships.
      for (int i = 0, length = cleaned.size(); i < length; i++) {
        index(cleaned.get(i));
      }

      // Now that we've index references to all spans, we can revise any parent-child relationships.
      // Notably, by now, we can tell which is the root-most.
      for (int i = 0, length = cleaned.size(); i < length; i++) {
        process(cleaned.get(i));
      }

      // If we haven't found any root span, we can still make a tree using a synthetic node.
      if (rootNode == null) {
        if (logger.isLoggable(FINE)) {
          logger.fine("substituting dummy node for missing root span: traceId=" + traceId);
        }
        rootNode = new SpanNode(null);
      }

      // At this point, we have the most reliable parent-child relationships and can allocate spans
      // corresponding the the best place in the trace tree.
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

    /**
     * We index spans by (id, shared, localEndpoint) before processing them. This latter fields
     * (shared, endpoint) are important because in zipkin (specifically B3), a server can share
     * (re-use) the same ID as its client. This impacts processing quite a bit when multiple servers
     * share one span ID.
     *
     * <p>In a Zipkin trace, a parent (client) and child (server) can share the same ID if in an
     * RPC. If two different servers respond to the same client, the only way for us to tell which
     * is which is by endpoint. Our goal is to retain full paths across multiple endpoints. Even
     * though instrumentation should be configured in such a way that a client never sends the same
     * span ID to multiple servers, it can happen. Accordingly, we index defensively including any
     * endpoint data that might be available.
     */
    void index(Span span) {
      // Assume first that we want to link to the same endpoint. We will post-process later if this
      // is incorrect.
      Key idKey = new Key(span.id(), span.shared(), null);
      Key parentKey = null;
      if (idKey.shared) { // assume the parent might be on another endpoint
        parentKey = new Key(idKey.id, false, null);
        keyToParent.put(new Key(idKey.id, true, span.localEndpoint()), parentKey);
      } else if (span.parentId() != null) {
        parentKey = new Key(span.parentId(), false, null);
      }

      keyToParent.put(idKey, parentKey);
    }

    /**
     * Processing is taking a span and placing it at the most appropriate place in the trace tree.
     * For example, if this is a {@link Span.Kind#SERVER} span, it would be a different node, and a
     * child of its {@link Span.Kind#CLIENT} even if they share the same span ID.
     *
     * <p>Processing is defensive of typical problems in span reporting, such as depth-first. For
     * example, depth-first reporting implies you can see spans missing their parent. Hence, the
     * result of processing all spans can be a virtual root node.
     */
    void process(Span span) {
      Endpoint endpoint = span.localEndpoint();
      Key key = new Key(span.id(), span.shared(), span.localEndpoint());
      Key noEndpointKey = endpoint != null ? new Key(span.id(), span.shared(), null) : key;

      Key parentKey = null;
      if (key.shared) {
        // For example, this is a server span. It will very likely be on a different endpoint than
        // the client. So we want to pick the first span that has the same ID and is not shared
        // (clients never know if they can be shared).
        parentKey = new Key(span.id(), false, null);
      } else if (span.parentId() != null) {
        // We are not a root span, and not a shared server span. Proceed in most specific to least.

        // We could be the child of a shared server span (ex a local (intermediate) span on the same
        // endpoint). This is the most specific case, so we try this first.
        parentKey = new Key(span.parentId(), true, endpoint);
        if (keyToParent.containsKey(parentKey)) {
          keyToParent.put(noEndpointKey, parentKey);
        } else {
          // Now, we know our own parent is a not a shared ID span: index it without an endpoint
          parentKey = new Key(span.parentId(), false, null);
        }
      } else { // we are root or don't know our parent
        if (rootNode != null) {
          if (logger.isLoggable(FINE)) {
            logger.fine(format(
              "attributing span missing parent to root: traceId=%s, rootSpanId=%s, spanId=%s",
              span.traceId(), rootNode.span().id(), key.id));
          }
        }
      }

      SpanNode node = new SpanNode(span);
      // special-case root, and attribute missing parents to it. In
      // other words, assume that the first root is the "real" root.
      if (parentKey == null && rootNode == null) {
        rootNode = node;
        keyToParent.remove(noEndpointKey);
      } else if (key.shared) {
        // in the case of shared server span, we need to address it both ways, in case intermediate
        // spans are lacking endpoint information.
        keyToNode.put(key, node);
        keyToNode.put(noEndpointKey, node);
      } else {
        keyToNode.put(noEndpointKey, node);
      }
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

    Key(String id, @Nullable Boolean shared, @Nullable Endpoint endpoint) {
      if (id == null) throw new NullPointerException("id == null");
      this.id = id;
      this.shared = Boolean.TRUE.equals(shared);
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

  @Override public String toString() {
    List<Span> childrenSpans = new ArrayList<>();
    for (int i = 0, length = children.size(); i < length; i++) {
      childrenSpans.add(children.get(i).span);
    }
    return "SpanNode{parent=" + (parent != null ? parent.span : null)
      + ", span=" + span + ", children=" + childrenSpans + "}";
  }
}
