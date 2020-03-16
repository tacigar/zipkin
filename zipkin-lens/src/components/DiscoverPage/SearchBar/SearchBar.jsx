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
import PropTypes from 'prop-types';
import React from 'react';
import { Button } from '@material-ui/core';
import { makeStyles } from '@material-ui/styles';
import { faSearch, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import Criterion from './Criterion';

const useStyles = makeStyles((theme) => ({
  root: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    boxShadow: theme.shadows[3],
    borderRadius: 3,
  },
  criteria: {
    flexGrow: 1,
    padding: theme.spacing(1),
    display: 'flex',
    alignItems: 'center',
    backgroundColor: theme.palette.common.white,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },
  appendButton: {
    minWidth: 36,
    width: 36,
    height: 36,
  },
  searchButton: {
    minWidth: 46,
    width: 46,
    height: '100%',
    boxShadow: 'none',
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
}));

const propTypes = {
  // For search conditions
  criteria: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      value: PropTypes.string,
    }),
  ).isRequired,

  // For suggestion
  services: PropTypes.arrayOf(PropTypes.string).isRequired,
  remoteServices: PropTypes.arrayOf(PropTypes.string).isRequired,
  spans: PropTypes.arrayOf(PropTypes.string).isRequired,
  autocompleteKeys: PropTypes.arrayOf(PropTypes.string).isRequired,
  autocompleteValues: PropTypes.arrayOf(PropTypes.string).isRequired,
  isLoadingServices: PropTypes.bool.isRequired,
  isLoadingRemoteServices: PropTypes.bool.isRequired,
  isLoadingSpans: PropTypes.bool.isRequired,
  isLoadingAutocompleteKeys: PropTypes.bool.isRequired,
  isLoadingAutocompleteValues: PropTypes.bool.isRequired,

  // Callbacks
  onClickSearchButton: PropTypes.func.isRequired,

  // Criteria operate functions
  appendCriterion: PropTypes.func.isRequired, // (newCriterion) => {}
  changeCriterion: PropTypes.func.isRequired, // (changedCriterion, index) => {}
  deleteCriterion: PropTypes.func.isRequired, // (index) => {}
  deleteAllCriteria: PropTypes.func.isRequired, // () => {}
};

const SearchBar = ({
  criteria,
  services,
  remoteServices,
  spans,
  autocompleteKeys,
  autocompleteValues,
  isLoadingServices,
  isLoadingRemoteServices,
  isLoadingSpans,
  isLoadingAutocompleteKeys,
  isLoadingAutocompleteValues,
  onClickSearchButton,
  appendCriterion,
  changeCriterion,
  deleteCriterion,
  deleteAllCriteria,
}) => {
  const classes = useStyles();

  const inputRefs = React.useRef([]);
  const handleRef = (index) => (ref) => {
    inputRefs.current[index] = ref;
  };

  const [criteriaIndex, setCriteriaIndex] = React.useState(-1);
  const handleCriterionClick = (index) => () => {
    setCriteriaIndex(index);
    setTimeout(() => {
      inputRefs.current[index].focus();
    }, 0);
  };

  const handleCriterionDecide = (index) => () => {
    setCriteriaIndex(-1);
    inputRefs.current[index].blur();
  };

  const handleAppendButtonClick = React.useCallback(() => {
    appendCriterion({ key: '', value: '' });

    const nextCriteriaIndex = criteria.length;
    setCriteriaIndex(nextCriteriaIndex);

    setTimeout(() => {
      inputRefs.current[nextCriteriaIndex].focus();
    }, 0);
  }, [appendCriterion, criteria.length]);

  return (
    <div className={classes.root}>
      <div className={classes.criteria}>
        {criteria.map((criterion, index) => (
          <Criterion
            ref={handleRef(index)}
            index={index}
            criterion={criterion}
            isFocused={index === criteriaIndex}
            onClick={handleCriterionClick(index)}
            onDecide={handleCriterionDecide(index)}
            services={services}
            remoteServices={remoteServices}
            spans={spans}
            autocompleteKeys={autocompleteKeys}
            autocompleteValues={autocompleteValues}
            isLoadingServices={isLoadingServices}
            isLoadingRemoteServices={isLoadingRemoteServices}
            isLoadingSpans={isLoadingSpans}
            isLoadingAutocompleteKeys={isLoadingAutocompleteKeys}
            isLoadingAutocompleteValues={isLoadingAutocompleteValues}
            changeCriterion={changeCriterion}
            deleteCriterion={deleteCriterion}
          />
        ))}
        <Button
          variant="contained"
          onClick={handleAppendButtonClick}
          className={classes.appendButton}
        >
          <FontAwesomeIcon icon={faPlus} />
        </Button>
      </div>
      <Button
        variant="contained"
        onClick={onClickSearchButton}
        className={classes.searchButton}
      >
        <FontAwesomeIcon icon={faSearch} />
      </Button>
    </div>
  );
};

SearchBar.propTypes = propTypes;

export default SearchBar;
