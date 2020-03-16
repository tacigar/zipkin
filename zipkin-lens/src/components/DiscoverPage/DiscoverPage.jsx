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
import { connect } from 'react-redux';

import SearchBar from './SearchBar';
import { fetchServices } from '../../actions/services-action';
import { fetchAutocompleteKeys } from '../../actions/autocomplete-keys-action';

const propTypes = {
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
  loadServices: PropTypes.func.isRequired,
  loadRemoteServices: PropTypes.func.isRequired,
  loadSpans: PropTypes.func.isRequired,
  loadAutocompleteKeys: PropTypes.func.isRequired,
  loadAutocompleteValues: PropTypes.func.isRequired,
};

const DiscoverPageImpl = ({
  location,
  history,
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
  loadServices,
  loadRemoteServices,
  loadSpans,
  loadAutocompleteKeys,
  loadAutocompleteValues,
}) => {
  const [criteria, setCriteria] = React.useState([]);

  React.useEffect(() => {
    loadAutocompleteKeys();
  }, []);

  const appendCriterion = (newCriterion) => {
    setCriteria((prev) => [...prev, newCriterion]);
  };

  const changeCriterion = (criterion, index) => {
    setCriteria((prev) => {
      const newCriteria = [...prev];
      newCriteria[index] = criterion;
      return newCriteria;
    });

    // If the key is changed, start fetching suggestion data if can.
    console.log(criteria, criterion, index);
    if (criteria[index].key !== criterion.key) {
      switch (criterion.key) {
        case 'service':
          loadServices();
          break;
        case 'remoteService':
          loadRemoteServices();
          break;
        case 'span':
          loadSpans();
          break;
        case 'minDuration':
        case 'maxDuration':
        case 'tag':
          break;
        default:
          if (autocompleteKeys.includes(criterion.key)) {

          }
      }
    }
  };

  return (
    <div>
      Discover
      <SearchBar
        criteria={criteria}
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
        appendCriterion={appendCriterion}
        changeCriterion={changeCriterion}
      />
    </div>
  );
};

DiscoverPageImpl.propTypes = propTypes;

const mapStateToProps = (state) => ({
  services: state.services.services,
  remoteServices: state.remoteServices.remoteServices,
  spans: state.spans.spans,
  autocompleteKeys: state.autocompleteKeys.autocompleteKeys,
  autocompleteValues: state.autocompleteValues.autocompleteValues,
  isLoadingServices: state.services.isLoading,
  isLoadingRemoteServices: state.remoteServices.isLoading,
  isLoadingSpans: state.spans.isLoadingSpans,
  isLoadingAutocompleteKeys: state.autocompleteKeys.isLoading,
  isLoadingAutocompleteValues: state.autocompleteValues.isLoading,
});

const mapDispatchToProps = (dispatch) => ({
  loadServices: () => dispatch(fetchServices()),
  loadAutocompleteKeys: () => dispatch(fetchAutocompleteKeys()),
});

export default connect(mapStateToProps, mapDispatchToProps)(DiscoverPageImpl);
