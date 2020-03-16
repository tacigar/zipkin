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
import { Box } from '@material-ui/core';
import { makeStyles } from '@material-ui/styles';

import SuggestionMenu from './SuggestionMenu';

const useStyles = makeStyles((theme) => ({
  input: {
    fontSize: '1.2rem',
    minWidth: 400,
    height: 34,
  },
}));

const propTypes = {
  index: PropTypes.number.isRequired,
  criterion: PropTypes.shape({
    key: PropTypes.string,
    value: PropTypes.string,
  }).isRequired,
  isFocused: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
  onDecide: PropTypes.func.isRequired,

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

  // Criteria operate functions
  changeCriterion: PropTypes.func.isRequired, // (changedCriterion, index) => {}
  deleteCriterion: PropTypes.func.isRequired, // (index) => {}
};

const Criterion = React.forwardRef(
  (
    {
      index,
      criterion,
      isFocused,
      onClick,
      onDecide,
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
      changeCriterion,
      deleteCriterion,
    },
    ref,
  ) => {
    const classes = useStyles();

    // text is a state that manages the value of the input component.
    const [text, setText] = React.useState('');

    // Split the currently input text into key and value.
    // If the key is currently being input, isSelecingKey will be true,
    // and if the value is being input, it will be false.
    const [key, value, isSelectingKey] = React.useMemo(() => {
      const [k, v] = text.split('=', 2);
      return [k || '', v || '', !text.includes('=')];
    }, [text]);

    const [suggestions, isLoadingSuggestions] = React.useMemo(() => {
      if (isSelectingKey) {
        if (isLoadingAutocompleteKeys) {
          return [[], true];
        }
        return [
          [
            'service',
            'remoteService',
            'span',
            'minDuration',
            'maxDuration',
            'tag',
            ...autocompleteKeys,
          ],
          false,
        ];
      }
      switch (criterion.key) {
        case 'service':
          return [services, isLoadingServices];
        case 'remoteService':
          return [remoteServices, isLoadingRemoteServices];
        case 'span':
          return [spans, isLoadingSpans];
        case 'minDuration':
          return [null, false];
        case 'maxDuration':
          return [null, false];
        case 'tag':
          return [null, false];
        default:
          if (autocompleteKeys.includes(criterion.key)) {
            return [autocompleteValues, isLoadingAutocompleteValues];
          }
          return [null, false];
      }
    }, [
      autocompleteKeys,
      autocompleteValues,
      criterion.key,
      isLoadingAutocompleteKeys,
      isLoadingAutocompleteValues,
      isLoadingRemoteServices,
      isLoadingServices,
      isLoadingSpans,
      isSelectingKey,
      remoteServices,
      services,
      spans,
    ]);

    // filteringText is a state that manages the text used to filter suggestions.
    const [filteringText, setFilteringText] = React.useState('');

    // If this value is null, the suggestion is not focused.
    // this value will be set to 0 the first time ArrowDown key is pressed.
    const [suggestionIndex, setSuggestionIndex] = React.useState(null);

    const filteredSuggestions = React.useMemo(() => {
      if (!suggestions || suggestions.length === 0) {
        return [];
      }
      return suggestions.filter((suggestion) =>
        suggestion.includes(filteringText),
      );
    }, [filteringText, suggestions]);

    const _backspaceText = React.useCallback(() => {
      if (text.length <= 0) {
        return;
      }
      setText(text.substr(0, text.length - 1));

      // Update filteringText as well.
      if (isSelectingKey) {
        if (key.length > 0) {
          setFilteringText(key.substr(0, key.length - 1));
          // Since suggestions may change, initialize suggestionIndex.
          setSuggestionIndex(null);
        }
      } else if (value.length > 0) {
        setFilteringText(value.substr(0, value.length - 1));
        // Since suggestions may change, initialize suggestionIndex.
        setSuggestionIndex(null);
      }
    }, [isSelectingKey, key, text, value]);

    // _inputChar is called when characters are manually input.
    const _inputChar = React.useCallback(
      (char) => {
        setText(`${text}${char}`);

        // Initialize suggestionIndex since suggestions may change
        // if manual input is done.
        setSuggestionIndex(null);

        // Update filteringText as well.
        if (isSelectingKey) {
          setFilteringText(`${key}${char}`);
        } else {
          setFilteringText(`${value}${char}`);
        }
      },
      [isSelectingKey, key, text, value],
    );

    const _decideKey = React.useCallback(() => {
      changeCriterion({ key, value: '' }, index);
      setFilteringText('');
      setText(`${key}=`);
    }, [changeCriterion, index, key]);

    const _decideValue = React.useCallback(() => {
      changeCriterion({ key, value }, index);
      setFilteringText('');
      onDecide();
    }, [changeCriterion, index, key, onDecide, value]);

    const _selectSuggestion = React.useCallback(
      (i) => {
        let newText;
        if (isSelectingKey) {
          newText = filteredSuggestions[i];
        } else {
          newText = `${key}=${filteredSuggestions[i]}`;
        }
        setText(newText);
      },
      [filteredSuggestions, isSelectingKey, key],
    );

    // Basically SearchBar component manages focus, but if the focus is lost
    // from the input of this component by operating children components,
    // this component focus to its input element again itself.
    // So this ref and callback are necessary.
    const inputEl = React.useRef();
    const handleInputRef = React.useCallback(
      (el) => {
        ref(el);
        inputEl.current = el;
      },
      [ref],
    );

    const handleSuggestionItemClick = (i) => () => {
      let newText;
      if (isSelectingKey) {
        newText = `${filteredSuggestions[i]}=`;
        changeCriterion(
          {
            key: filteredSuggestions[i],
            value: '',
          },
          i,
        );
        // When a suggestion item is clicked, focus will be lost from the input element.
        // So need to focus again.
        inputEl.current.focus();
      }
      setText(newText);
    };

    const listEl = React.useRef();
    console.log(listEl.current);

    const handleKeyDown = React.useCallback(
      (event) => {
        switch (event.key) {
          case 'Enter':
            event.preventDefault();
            if (isSelectingKey) {
              _decideKey();
            } else {
              _decideValue();
            }
            break;
          case 'ArrowUp':
            event.preventDefault();
            if (
              !isLoadingSuggestions &&
              suggestions &&
              suggestions.length > 0
            ) {
              if (suggestionIndex !== null && suggestionIndex > 0) {
                const newIndex = suggestionIndex - 1;
                setSuggestionIndex(newIndex);
                _selectSuggestion(newIndex);
                listEl.current.scrollToItem(newIndex);
              }
            }
            break;
          case 'ArrowDown':
            event.preventDefault();
            if (
              !isLoadingSuggestions &&
              suggestions &&
              suggestions.length > 0
            ) {
              if (suggestionIndex === null) {
                setSuggestionIndex(0);
                _selectSuggestion(0);
              } else if (suggestionIndex < filteredSuggestions.length - 1) {
                const newIndex = suggestionIndex + 1;
                setSuggestionIndex(newIndex);
                _selectSuggestion(newIndex);
                listEl.current.scrollToItem(newIndex);
              }
            }
            break;
          case 'Backspace':
            event.preventDefault();
            _backspaceText();
            break;
          default: {
            event.preventDefault();
            const k = String.fromCharCode(event.keyCode);
            if (k.match(/[a-zA-Z0-9_-]/)) {
              _inputChar(event.key);
            }
            break;
          }
        }
      },
      [
        _backspaceText,
        _decideKey,
        _decideValue,
        _inputChar,
        _selectSuggestion,
        filteredSuggestions.length,
        isLoadingSuggestions,
        isSelectingKey,
        suggestionIndex,
        suggestions,
      ],
    );

    if (!isFocused) {
      return (
        <Box onClick={onClick}>
          {criterion.key}/{criterion.value}
        </Box>
      );
    }

    let suggestionMenu;
    if (
      isSelectingKey ||
      (!isSelectingKey &&
        (criterion.key === 'service' ||
          criterion.key === 'remoteService' ||
          criterion.key === 'spans' ||
          autocompleteKeys.includes(criterion.key)))
    ) {
      suggestionMenu = (
        <SuggestionMenu
          ref={listEl}
          title={isSelectingKey ? 'Criteria' : criterion.key}
          suggestionIndex={suggestionIndex}
          suggestions={filteredSuggestions}
          isLoadingSuggestions={isLoadingSuggestions}
          onClickItem={handleSuggestionItemClick}
        />
      );
    }

    return (
      <Box position="relative">
        <input
          ref={handleInputRef}
          value={text}
          onKeyDown={handleKeyDown}
          className={classes.input}
        />
        {suggestionMenu}
      </Box>
    );
  },
);

Criterion.propTypes = propTypes;

export default Criterion;
