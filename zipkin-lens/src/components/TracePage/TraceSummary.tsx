/*
 * Copyright 2015-2021 The OpenZipkin Authors
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

import React, { useState, useCallback, useMemo } from 'react';
import Box from '@material-ui/core/Box';
import { useToggle } from 'react-use';

import TracePageHeader from './TracePageHeader';
import TraceTimeline from './TraceTimeline';
import SpanDetail from './SpanDetail';
import AdjustedTrace, { AdjustedSpan } from '../../models/AdjustedTrace';

const getInitialClosedSpanIds = (spans: AdjustedSpan[]) => {
  const ret: { [key: string]: boolean } = {};
  for (let i = 0; i < spans.length - 1; i += 1) {
    const span = spans[i];
    const nextSpan = spans[i + 1];
    if (span.depth < nextSpan.depth) {
      ret[span.spanId] = false;
    }
  }
  return ret;
};

interface TraceSummaryProps {
  traceSummary: AdjustedTrace;
}

const TraceSummary = React.memo<TraceSummaryProps>(({ traceSummary }) => {
  const [rootSpanId, setRootSpanId] = useState<string>();
  const rootSpan = useMemo(
    () => traceSummary.spans.find((span) => span.spanId === rootSpanId),
    [rootSpanId, traceSummary.spans],
  );
  const [currentSpanId, setCurrentSpanId] = useState<string>(
    traceSummary.spans[0].spanId,
  );
  const currentSpan = useMemo(
    () => traceSummary.spans.find((span) => span.spanId === currentSpanId),
    [currentSpanId, traceSummary.spans],
  );
  const [closedSpanIds, setClosedSpanIds] = useState(
    getInitialClosedSpanIds(traceSummary.spans),
  );
  const [openSpanDetail, toggleOpenSpanDetail] = useToggle(true);
  const traceTimelineWidthPercent = openSpanDetail ? 60 : 100;

  const toggleChildren = useCallback((spanId: string) => {
    setClosedSpanIds((prev) => ({
      ...prev,
      [spanId]: !prev[spanId],
    }));
  }, []);

  const reroot = useCallback((spanId?: string) => {
    setRootSpanId(spanId);
  }, []);

  const rerootedTree = useMemo(() => {
    if (!rootSpanId) {
      return traceSummary.spans;
    }
    const rootSpanIndex = traceSummary.spans.findIndex(
      (span) => span.spanId === rootSpanId,
    );
    const root = traceSummary.spans[rootSpanIndex];
    const spans = [root];
    for (let i = rootSpanIndex + 1; i < traceSummary.spans.length; i += 1) {
      const span = traceSummary.spans[i];
      if (span.depth <= root.depth) {
        break;
      }
      spans.push(span);
    }
    return spans;
  }, [rootSpanId, traceSummary.spans]);

  const shownTree = useMemo(() => {
    let childrenHiddenSpanDepth: number = Number.MAX_VALUE;
    return rerootedTree.reduce((acc, span) => {
      if (span.depth > childrenHiddenSpanDepth) {
        return acc;
      }
      childrenHiddenSpanDepth = Number.MAX_VALUE;
      acc.push(span);
      if (closedSpanIds[span.spanId]) {
        childrenHiddenSpanDepth = span.depth;
      }
      return acc;
    }, [] as AdjustedSpan[]);
  }, [rerootedTree, closedSpanIds]);

  return (
    <Box height="calc(100vh - 64px)" display="flex" flexDirection="column">
      <Box flexShrink={0} zIndex={1001}>
        <TracePageHeader traceSummary={traceSummary} rootSpan={rootSpan} />
      </Box>
      <Box display="flex" flexGrow={1} overflow="auto">
        <Box
          width={`${traceTimelineWidthPercent}%`}
          display="flex"
          flexDirection="column"
          height="100%"
        >
          <Box flexGrow={1} width="100%" overflow="auto">
            <TraceTimeline
              closedSpanIds={closedSpanIds}
              openSpanDetail={openSpanDetail}
              reroot={reroot}
              rootSpanId={rootSpanId}
              rowHeight={40}
              setCurrentSpanId={setCurrentSpanId}
              spans={shownTree}
              toggleChildren={toggleChildren}
              toggleOpenSpanDetail={toggleOpenSpanDetail}
            />
          </Box>
        </Box>
        <Box
          width={`${100 - traceTimelineWidthPercent}%`}
          height="100%"
          boxShadow={3}
          zIndex={1000}
        >
          <SpanDetail span={currentSpan} reroot={reroot} />
        </Box>
      </Box>
    </Box>
  );
});

export default TraceSummary;
