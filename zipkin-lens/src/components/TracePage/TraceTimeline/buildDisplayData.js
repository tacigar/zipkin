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

export const buildDisplayData = (spans) => {
  // Initialize the result data array, because its size is fixed.
  const res = new Array(spans.length);
  for (let i = 0; i < res.length; i += 1) {
    res[i] = {
      verticalLines: {},
    };
  }

  const stack = [];
  for (let i = 0; i < spans.length; i += 1) {
    const span = spans[i];
    const top = stack[stack.length - 1];

    if (i === 0) {
      stack.push({ index: 0, depth: span.depth });
      continue;
    }
    if (top.depth > span.depth) {
      const processed = [];
      for (let j = stack.length - 1; j >= 0; j -= 1) {
        if (stack[j].depth < span.depth) {
          break;
        }
        processed.unshift(stack.pop());
      }

      for (let j = 0; j < processed.length - 1; j += 1) {
        const start = processed[j];
        const end = processed[j + 1];
        res[start.index].verticalLines[end.depth] = 'BACK_HALF';
        res[end.index].verticalLines[end.depth] = 'FRONT_HALF';
        for (let k = start.index + 1; k < end.index; k += 1) {
          res[k].verticalLines[end.depth] = 'FULL';
        }
      }
      stack.push({ index: i, depth: span.depth });
    } else if (top.depth === span.depth) {
      stack.pop();
      stack.push({ index: i, depth: span.depth });
    } else {
      stack.push({ index: i, depth: span.depth });
    }
  }

  for (let j = 0; j < stack.length - 1; j += 1) {
    const start = stack[j];
    const end = stack[j + 1];
    res[start.index].verticalLines[end.depth] = 'BACK_HALF';
    res[end.index].verticalLines[end.depth] = 'FRONT_HALF';
    for (let k = start.index + 1; k < end.index; k += 1) {
      res[k].verticalLines[end.depth] = 'FULL';
    }
  }
  return res;
};
