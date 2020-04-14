import React from 'react';
import { useDispatch } from 'react-redux';
import { Box } from '@material-ui/core';

import { Criterion } from '../types';
import { fetchServices } from '../../../actions/services-action';
import { fetchSpans } from '../../../actions/spans-action';
import { fetchRemoteServices } from '../../../actions/remote-services-action';

interface Props {
  criteria: Criterion[];
  // Criteria operating functions.
  appendCriterion: (criterion: Criterion) => void;
  changeCriterion: (index: number, criterion: Criterion) => void;
  deleteCriterion: (index: number) => void;
  deleteAllCriteria: () => void;
}

const SearchBar: React.FC<Props> = ({
  criteria,
  appendCriterion,
  changeCriterion,
  deleteCriterion,
  deleteAllCriteria,
}): JSX.Element => {
  // inputEls manages all criteria's input element.
  const inputEls = React.useRef<HTMLInputElement[]>([]);

  const setInputRef = (index: number) => (el: HTMLInputElement) => {
    inputEls.current[index] = el;
  };

  // criterionIndex is the focused criterion's index of the criterion prop.
  // If this value is -1, there are no focused criteria.
  const [criterionIndex, setCriterionIndex] = React.useState(-1);

  const handleCriterionClick = (index: number) => () => {
    setCriterionIndex(index);

    // Do setTimeout to ensure focus after blur process of the other criterion component.
    window.setTimeout(() => {
      inputEls.current[index].focus();
    }, 0);
  };

  const handleCriterionDecide = (index: number) => () => {
    setCriterionIndex(-1);
    inputEls.current[index].blur();
  };

  const handleAppendButtonClick = React.useCallback(() => {
    appendCriterion({ key: '', value: '' });

    const nextIndex = criteria.length;
    setCriterionIndex(nextIndex);

    // Do focus after the new criterion component is mounted.
    window.setTimeout(() => {
      inputEls.current[nextIndex].focus();
    }, 0);
  }, [appendCriterion, criteria.length]);

  const _changeCriterion = (index: number) => (criterion: Criterion) => {
    changeCriterion(index, criterion);
  };

  const dispatch = useDispatch();

  // Load service names only once when the service bar component is mounted.
  React.useEffect(() => {
    dispatch(fetchServices());
  }, [dispatch]);

  // Reload span names and remote service names every time the
  // service name criterion changes.
  const prevServiceName = React.useRef('');
  React.useEffect(() => {
    const serviceNameCriterion = criteria.find(
      (criterion) => criterion.key === 'serviceName',
    );
    if (!serviceNameCriterion) {
      return;
    }
    if (prevServiceName.current !== serviceNameCriterion.key) {
      prevServiceName.current = serviceNameCriterion.key;
      dispatch(fetchSpans(serviceNameCriterion.key));
      dispatch(fetchRemoteServices(serviceNameCriterion.key));
    }
  }, [criteria, dispatch]);

  return (
    <Box
      display="flex"
      borderRadius={3}
      bgcolor="background.paper"
      p={1}
      boxShadow={3}
    >
      <Box display="flex" flexWrap="wrap">
        {criteria.map((criterion, index) => (
          <Box mr={1}>
            <Criterion
              setInputRef={setInputRef(index)}
              criterion={criterion}
              changeCriterion={_changeCriterion(index)}
            />
          </Box>
        ))}
      </Box>
    </Box>
  )
};

export default SearchBar;
