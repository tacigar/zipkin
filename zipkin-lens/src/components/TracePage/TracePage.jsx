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
import LinearProgress from '@material-ui/core/LinearProgress';

import { detailedTraceSummaryPropTypes } from '../../prop-types';

const propTypes = {
  isLoading: PropTypes.bool.isRequired,
  traceId: PropTypes.string.isRequired,
  traceSummary: detailedTraceSummaryPropTypes,
  loadTrace: PropTypes.func.isRequired,
};

const defaultProps = {
  traceSummary: null,
};

const TracePage = ({
  isLoading,
  traceId,
  traceSummary,
  loadTrace,
}) => {
  if (isLoading) {
    return (
      <Box>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box>

    </Box>
  )
};

TracePage.propTypes = propTypes;
TracePage.defaultProps = defaultProps;

export default TracePage;
