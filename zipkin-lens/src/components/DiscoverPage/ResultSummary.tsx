/*
 * Copyright 2015-2020 The OpenZipkin Authors
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

import {
  Box,
  Button,
  Collapse,
  Divider,
  IconButton,
  Paper,
  Typography,
} from '@material-ui/core';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import FilterListIcon from '@material-ui/icons/FilterList';
import moment from 'moment';
import React, { useCallback, useMemo, useState } from 'react';
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

import { selectColorByInfoClass } from '../../colors';
import TraceSummary from '../../models/TraceSummary';
import { formatDuration } from '../../util/timestamp';

interface ResultSummaryProps {
  traceSummaries: TraceSummary[];
}

const ResultSummary: React.FC<ResultSummaryProps> = ({ traceSummaries }) => {
  const [openChart, setOpenChart] = useState(true);

  const handleChartCollapseButton = useCallback(() => {
    setOpenChart((prev) => !prev);
  }, []);

  const traceSummariesMap = useMemo(
    () =>
      traceSummaries.reduce((acc, cur) => {
        const infoClass = !cur.infoClass ? 'normal' : cur.infoClass;
        if (!acc[infoClass]) {
          acc[infoClass] = [] as TraceSummary[];
        }
        acc[infoClass].push(cur);
        return acc;
      }, {} as { [key: string]: TraceSummary[] }),
    [traceSummaries],
  );

  return (
    <Paper elevation={3}>
      <Collapse in={openChart}>
        <Box width="100%" height={250} pt={2} pb={1} pl={4} pr={4}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 20, right: 30, bottom: 10, left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                name="Start Time"
                domain={['auto', 'auto']}
                type="number"
                tickFormatter={(ts) => moment(ts).format('HH:mm:ss:SSS')}
              />
              <YAxis
                dataKey="duration"
                name="Duration"
                domain={['auto', 'auto']}
                type="number"
                tickFormatter={(duration) => formatDuration(duration)}
              />
              <ZAxis dataKey="spanCount" name="Span Count" range={[200, 700]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(value, name) => {
                  switch (name) {
                    case 'Start Time':
                      return moment(value).format('M/DD HH:mm:ss:SSS');
                    case 'Duration':
                      return formatDuration(value);
                    case 'Span Count':
                      return value;
                    default:
                      return value;
                  }
                }}
              />
              {Object.keys(traceSummariesMap).map((infoClass) => (
                <Scatter
                  data={traceSummariesMap[infoClass]}
                  fill={selectColorByInfoClass(infoClass)}
                  opacity={0.7}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </Box>
      </Collapse>
      <Divider />
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        pt={1}
        pb={1}
        pl={3}
        pr={3}
      >
        <Typography variant="h6">{traceSummaries.length} Traces</Typography>
        <Box display="flex" alignItems="center">
          <Button startIcon={<FilterListIcon />}>Filter</Button>
          <Box ml={2}>
            <IconButton onClick={handleChartCollapseButton}>
              {openChart ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

export default ResultSummary;
