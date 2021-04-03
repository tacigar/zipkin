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

import { Box, createStyles, makeStyles, Theme } from '@material-ui/core';
import React from 'react';
import { selectServiceColor } from '../../../constants/color';
import { AdjustedSpan } from '../../../models/AdjustedTrace';

import { TreeElementType } from './buildTimelineTree';

const buttonSizePx = 18;

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      cursor: 'pointer',
      '&:hover': {
        backgroundColor: theme.palette.grey[200],
      },
    },
    treeBegin: {
      borderTop: `1px solid ${theme.palette.grey[300]}`,
      borderLeft: `1px solid ${theme.palette.grey[300]}`,
    },
    treeMiddle: {
      borderLeft: `1px solid ${theme.palette.grey[300]}`,
    },
    treeMiddleWithBranch: {
      borderTop: `1px solid ${theme.palette.grey[300]}`,
      borderLeft: `1px solid ${theme.palette.grey[300]}`,
    },
    treeEnd: {
      borderTop: `1px solid ${theme.palette.grey[300]}`,
    },
  }),
);

interface TraceTimelineRowProps {
  endTs: number;
  rowHeight: number;
  span: AdjustedSpan;
  startTs: number;
  treeData: (TreeElementType | undefined)[];
  treeWidthPercent: number;
}

const TraceTimelineRow = React.memo<TraceTimelineRowProps>(
  ({ endTs, rowHeight, span, startTs, treeData, treeWidthPercent }) => {
    const classes = useStyles();

    const buttons: JSX.Element[] = [];
    for (let i = 0; i < treeData.length; i += 1) {
      const elemType = treeData[i];
      if (elemType === 'BEGIN') {
        buttons.push(
          <button
            type="button"
            style={{
              position: 'absolute',
              left: `calc(${(100 / treeData.length) * i}% - ${
                buttonSizePx / 2
              }px)`,
              top: `${rowHeight / 2 - buttonSizePx / 2}px`,
              width: `${buttonSizePx}px`,
              height: `${buttonSizePx}px`,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            +
          </button>,
        );
      }
    }

    let isBranch = true;
    const tree: JSX.Element[] = [];
    const commonProps = {
      height: rowHeight,
      width: `${100 / treeData.length}%`,
      style: {
        transform: `translateY(${rowHeight / 2}px)`,
      },
    };
    for (let i = treeData.length - 1; i >= 0; i -= 1) {
      const tp = treeData[i];
      switch (tp) {
        case 'MIDDLE':
          if (isBranch) {
            tree.push(
              <Box {...commonProps} className={classes.treeMiddleWithBranch} />,
            );
          } else {
            tree.push(<Box {...commonProps} className={classes.treeMiddle} />);
          }
          isBranch = false;
          break;
        case 'END':
          isBranch = false;
          tree.push(<Box {...commonProps} className={classes.treeEnd} />);
          break;
        case 'BEGIN':
          tree.push(<Box {...commonProps} className={classes.treeBegin} />);
          break;
        default:
          if (isBranch) {
            tree.push(<Box {...commonProps} className={classes.treeEnd} />);
          } else {
            tree.push(<Box {...commonProps} />);
          }
      }
    }

    let left = 0;
    if (span.timestamp) {
      left = ((span.timestamp - startTs) / (endTs - startTs)) * 100;
    }
    const width = Math.max((span.duration / (endTs - startTs)) * 100, 1);

    return (
      <Box pl={2} display="flex" className={classes.root}>
        <Box
          width={`${treeWidthPercent}%`}
          display="flex"
          flexShrink={0}
          position="relative"
        >
          {tree}
          {buttons}
        </Box>
        <Box flexGrow={1} position="relative">
          <Box
            height={rowHeight}
            style={{
              transform: `translateY(${rowHeight / 2}px)`,
            }}
            className={classes.treeEnd}
          />
          <Box
            position="absolute"
            display="flex"
            alignItems="center"
            top={0}
            bottom={0}
            left={`${left}%`}
            width={`${width}%`}
            zIndex={100}
          >
            <Box
              style={{
                opacity: 0.8,
              }}
              width="100%"
              height={10}
              bgcolor={selectServiceColor(span.serviceName)}
              borderRadius={3}
            />
          </Box>
          <Box
            position="absolute"
            width="100%"
            pl={2}
            pr={2}
            display="flex"
            justifyContent="space-between"
            style={{
              opacity: 0.8,
              transform: `translateY(${-(rowHeight + 3)}px)`,
            }}
          >
            <Box display="flex">
              <Box mr={0.5}>{span.serviceName}:</Box>
              <Box color="text.secondary">{span.spanName}</Box>
            </Box>
            <Box>{span.durationStr}</Box>
          </Box>
        </Box>
      </Box>
    );
  },
);

export default TraceTimelineRow;
