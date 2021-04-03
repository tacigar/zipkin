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

import { Box } from '@material-ui/core';
import React, { useMemo } from 'react';

import { AdjustedSpan } from '../../../models/AdjustedTrace';
import TraceTimelineRow from './TraceTimelineRow';
import buildTimelineTree from './buildTimelineTree';

const treeWidthPercent = 10;

const extractStartTsAndEndTs = (spans: AdjustedSpan[]) => {
  let startTs = Number.MAX_VALUE;
  let endTs = Number.MIN_VALUE;
  spans.forEach((span) => {
    if (typeof span.timestamp !== 'undefined') {
      startTs = Math.min(startTs, span.timestamp);
      endTs = Math.max(endTs, span.timestamp + span.duration);
    }
  });
  return [startTs, endTs];
};

interface TraceTimelineProps {
  rowHeight: number;
  spans: AdjustedSpan[];
}

const TraceTimeline = React.memo<TraceTimelineProps>(({ spans, rowHeight }) => {
  const [startTs, endTs] = useMemo(() => extractStartTsAndEndTs(spans), [
    spans,
  ]);
  const tree = useMemo(() => buildTimelineTree(spans), [spans]);
  return (
    <Box bgcolor="background.paper">
      {spans.map((span, index) => (
        <TraceTimelineRow
          key={span.spanId}
          endTs={endTs}
          rowHeight={rowHeight}
          span={span}
          startTs={startTs}
          treeData={tree[index]}
          treeWidthPercent={treeWidthPercent}
        />
      ))}
    </Box>
  );
});

export default TraceTimeline;
