/*
 * Copyright 2015-2019 The OpenZipkin Authors
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
import PropTypes from 'prop-types';
import React from 'react';
import { makeStyles } from '@material-ui/styles';
import grey from '@material-ui/core/colors/grey';

import { selectServiceColor } from '../../colors';

const spanDataLineHeight = 2.5; // rem
const spanBarLineHeight = 1.0; // rem
const spanBarHeight = 0.75; // rem
const spanBarBorderRadius = 2; // px

const useStyles = makeStyles({
  spanRow: {
    cursor: 'pointer',
    fill: 'white',
    '&:hover': {
      fill: grey[100],
    },
  },
});

const TraceTimeline = ({ traceSummary }) => {
  const classes = useStyles();

  if (traceSummary.spans.length <= 1) {
    return null;
  }

  const renderLine = () => {
    const result = [];
    const stack = [];
    for (let i = 0; i < traceSummary.spans.length; i += 1) {
      const spanBarPosY = i * (spanDataLineHeight + spanBarLineHeight) + spanDataLineHeight;
      const current = traceSummary.spans[i];

      console.log(i, current.serviceName, stack);

      if (stack.length === 0) {
        stack.push({
          index: i,
          depth: current.depth,
        });
      } else if (stack[stack.length - 1].depth < current.depth) {
        const parent = stack[stack.length - 1];
        stack.push({
          index: i,
          depth: current.depth,
        });
        result.push(
          <line
            stroke="#333"
            strokeWidth={1}
            x1={parent.depth * 5}
            x2="100%"
            y1={`${spanBarPosY + spanBarHeight / 2}rem`}
            y2={`${spanBarPosY + spanBarHeight / 2}rem`}
          />,
        );
      } else if (stack[stack.length - 1].depth === current.depth) {
        stack.pop();
        const parent = stack[stack.length - 1];
        stack.push({
          index: i,
          depth: current.depth,
        });
        result.push(
          <line
            stroke="#333"
            strokeWidth={1}
            x1={parent.depth * 5}
            x2="100%"
            y1={`${spanBarPosY + spanBarHeight / 2}rem`}
            y2={`${spanBarPosY + spanBarHeight / 2}rem`}
          />,
        );
      } else if (stack[stack.length - 1].depth > current.depth) {
        const poped = [];
        for (let j = stack.length - 1; j >= 0; j -= 1) {
          if (stack[j].depth >= current.depth) {
            poped.push(stack.pop());
          } else {
            break;
          }
        }
        const parent = stack[stack.length - 1];

        console.log(parent);

        stack.push({
          index: i,
          depth: current.depth,
        });

        result.push(
          <line
            stroke="#333"
            strokeWidth={1}
            x1={parent.depth * 5}
            x2="100%"
            y1={`${spanBarPosY + spanBarHeight / 2}rem`}
            y2={`${spanBarPosY + spanBarHeight / 2}rem`}
          />,
        );

        for (let j = 0; j < poped.length - 1; j += 1) {
          result.push(
            <line
              stroke="#333"
              strokeWidth={1}
              x1={poped[j].depth * 4}
              x2={poped[j].depth * 4}
              y1={`${poped[j].index * (spanDataLineHeight + spanBarLineHeight) + spanDataLineHeight * 1.1}rem`}
              y2={`${poped[j + 1].index * (spanDataLineHeight + spanBarLineHeight) + spanDataLineHeight * 1.1}rem`}
            />,
          );
        }
      }
    }

    result.push(
      <line
        stroke="#333"
        strokeWidth={1}
        x1={0}
        x2="100%"
        y1={`${spanDataLineHeight + spanBarHeight / 2}rem`}
        y2={`${spanDataLineHeight + spanBarHeight / 2}rem`}
      />,
    );

    for (let j = 0; j < stack.length - 1; j += 1) {
      result.push(
        <line
          stroke="#333"
          strokeWidth={1}
          x1={stack[j].depth * 4}
          x2={stack[j].depth * 4}
          y1={`${stack[j].index * (spanDataLineHeight + spanBarLineHeight) + spanDataLineHeight * 1.1}rem`}
          y2={`${stack[j + 1].index * (spanDataLineHeight + spanBarLineHeight) + spanDataLineHeight * 1.1}rem`}
        />,
      );
    }

    return result;
  };

  return (
    <svg
      version="1.1"
      width="100%"
      height="100vh"
      xmlns="http://www.w3.org/2000/svg"
    >
      <svg x="0%" width="5%">
        {
          renderLine()
        }
      </svg>
      <svg x="5%" width="95%">
        {
          traceSummary.spans.map((span, i) => {
            const spanRowPosY = i * (spanDataLineHeight + spanBarLineHeight);
            const spanDataPosY = i * (spanDataLineHeight + spanBarLineHeight) + spanDataLineHeight * 2 / 3;
            const spanBarPosY = i * (spanDataLineHeight + spanBarLineHeight) + spanDataLineHeight;

            return (
              <g key={span.spanId}>
                <rect
                  width="100%"
                  height={`${spanBarLineHeight + spanDataLineHeight}rem`}
                  x="0"
                  y={`${spanRowPosY}rem`}
                  className={classes.spanRow}
                />
                <text
                  x="5%"
                  y={`${spanDataPosY}rem`}
                  style={{
                    textTransform: 'uppercase',
                  }}
                >
                  {span.serviceName}
                </text>
                <text
                  x="30%"
                  y={`${spanDataPosY}rem`}
                >
                  {span.spanName}
                </text>
                <line
                  x1="0"
                  x2="100%"
                  y1={`${spanBarPosY + spanBarHeight / 2}rem`}
                  y2={`${spanBarPosY + spanBarHeight / 2}rem`}
                  strokeWidth="1"
                  stroke="#999"
                />
                <rect
                  width={`${span.width}%`}
                  height={`${spanBarHeight}rem`}
                  x={`${span.left}%`}
                  y={`${spanBarPosY}rem`}
                  rx={spanBarBorderRadius}
                  ry={spanBarBorderRadius}
                  fill={selectServiceColor(span.serviceName)}
                />
              </g>
            );
          })
        }
      </svg>
    </svg>
  );
};

export default TraceTimeline;
