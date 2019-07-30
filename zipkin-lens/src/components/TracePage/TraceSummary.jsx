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
import Box from '@material-ui/core/Box';

import Timeline from '../Timeline';
import MiniTimeline from '../MiniTimeline';

const propTypes = {
  startTs: PropTypes.number,
  endTs: PropTypes.number,
  onStartAndEndTsChange: PropTypes.func.isRequired,
  traceSummary: detailedTraceSummaryPropTypes.isRequired,
};

const TraceSummary = ({
  startTs,
  endTs,
  onStartAndEndTsChange,
  traceSummary,
}) => {
  return (
    <Box display="flex" flexDirection="column" height="100vh">
      <TraceSummaryHeader traceSummary={traceSummary} />

    </Box>
  );
};

export default TraceSummary;
