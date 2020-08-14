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

/* eslint-disable no-shadow */

import {
  Accordion,
  AccordionActions,
  AccordionDetails as MuiAccordionDetails,
  AccordionSummary as MuiAccordionSummary,
  Box,
  Button,
  Typography,
  Divider,
  Grid,
  Chip as MuiChip,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import moment from 'moment';
import React from 'react';
import styled from 'styled-components';

import { selectColorByInfoClass, selectServiceTheme } from '../../colors';
import TraceSummary from '../../models/TraceSummary';
import { formatDuration } from '../../util/timestamp';

interface TraceSummaryAccordionProps {
  traceSummary: TraceSummary;
}

const TraceSummaryAccordion: React.FC<TraceSummaryAccordionProps> = ({
  traceSummary,
}) => {
  const ts = moment(traceSummary.timestamp / 1000);

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          width="100%"
        >
          <Box display="flex" alignItems="center">
            <Typography variant="h6">
              <strong>{traceSummary.root.serviceName}:</strong>
            </Typography>
            <Box ml={1} mr={1}>
              <Typography variant="h6" color="textSecondary">
                {traceSummary.root.spanName}
              </Typography>
            </Box>
          </Box>
          <Typography variant="body1">
            {formatDuration(traceSummary.duration)}
          </Typography>
        </Box>
        <Bar
          width={traceSummary.width}
          infoClass={traceSummary.infoClass || ''}
        />
      </AccordionSummary>
      <Divider />
      <AccordionDetails>
        <Grid container>
          <Grid item xs={3}>
            <Typography variant="caption" color="textSecondary">
              Start Time
            </Typography>
            <Box display="flex" alignItems="center">
              <Typography variant="body1">{ts.fromNow()}</Typography>
              <Box ml={1}>
                <Typography variant="body2" color="textSecondary">
                  ({ts.format('M/DD HH:mm:ss:SSS')})
                </Typography>
              </Box>
            </Box>
          </Grid>
          <ServicesGrid item xs={9}>
            <Typography color="textSecondary" variant="caption">
              Services and Span Counts
            </Typography>
            <ChipsWrapper>
              {traceSummary.serviceSummaries.map((serviceSummary) => (
                <Chip
                  serviceName={serviceSummary.serviceName}
                  spanCount={serviceSummary.spanCount}
                  onClick={() => {}}
                />
              ))}
            </ChipsWrapper>
          </ServicesGrid>
          {/*
          <TraceIdGrid item xs={2}>
            <Typography color="textSecondary" variant="caption">
              Trace ID
            </Typography>
            <Typography variant="body1">{traceSummary.traceId}</Typography>
          </TraceIdGrid>
          */}
        </Grid>
      </AccordionDetails>
      <Divider />
      <AccordionActions>
        <Button size="small" variant="outlined">
          Go To Trace
        </Button>
      </AccordionActions>
    </Accordion>
  );
};

export default TraceSummaryAccordion;

const AccordionSummary = styled(MuiAccordionSummary)`
  &.Mui-expanded {
    min-height: 48px;
  }
  > .MuiAccordionSummary-content {
    &.Mui-expanded {
      margin: 0px;
    }
  }
`;

const AccordionDetails = styled(MuiAccordionDetails)`
  padding: 8px 16px;
`;

const Bar = styled.div<{ width: number; infoClass: string }>`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: ${({ width }) => width}%;
  background-color: ${({ infoClass }) => selectColorByInfoClass(infoClass)};
  opacity: 0.25;
`;

const ServicesGrid = styled(Grid)`
  padding-left: ${({ theme }) => theme.spacing(2)}px;
  border-left: 1px solid ${({ theme }) => theme.palette.divider};
`;

const ChipsWrapper = styled.div`
  margin-top: ${({ theme }) => theme.spacing(0.5)}px;
  & > * {
    margin: ${({ theme }) => theme.spacing(0.25)}px;
  }
`;

const Chip = styled(MuiChip).attrs<{
  serviceName: string;
  spanCount: number;
}>(({ serviceName, spanCount }) => ({
  color: 'primary',
  label: `${serviceName} (${spanCount})`,
  size: 'small',
}))<{ serviceName: string; spanCount: number }>`
  background-color: ${({ serviceName }) =>
    selectServiceTheme(serviceName).palette.primary.dark};
  &:hover,
  &:focus {
    background-color: ${({ serviceName }) =>
      selectServiceTheme(serviceName).palette.primary.main};
  }
`;
