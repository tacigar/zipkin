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
import { ListItem, ListItemText, ListSubheader } from '@material-ui/core';
import { makeStyles } from '@material-ui/styles';
import { AutoSizer } from 'react-virtualized';
import { FixedSizeList as List } from 'react-window';

const useStyles = makeStyles((theme) => ({
  root: {
    position: 'absolute',
    top: 38,
    left: 0,
    right: 0,
    backgroundColor: theme.palette.common.white,
    boxShadow: theme.shadows[3],
    height: 300,
    overflowY: 'auto',
  },
  listSubheader: {
    paddingLeft: theme.spacing(0.8),
    paddingRight: theme.spacing(0.8),
    paddingTop: theme.spacing(0.4),
    paddingBottom: theme.spacing(0.4),
    lineHeight: '20px',
    backgroundColor: theme.palette.grey[100],
    borderBottom: `1px solid ${theme.palette.grey[300]}`,
  },
  listItem: {
    paddingLeft: theme.spacing(1.5),
    paddingRight: theme.spacing(1.5),
    paddingTop: theme.spacing(0.4),
    paddingBottom: theme.spacing(0.4),
  },
}));

const propTypes = {
  title: PropTypes.string,
  suggestionIndex: PropTypes.number.isRequired,
  suggestions: PropTypes.arrayOf(PropTypes.string).isRequired,
  isLoadingSuggestions: PropTypes.bool.isRequired,
  onClickItem: PropTypes.func.isRequired,
};

const defaultProps = {
  title: '',
};

const SuggestionMenu = React.forwardRef(
  (
    { title, suggestionIndex, suggestions, isLoadingSuggestions, onClickItem },
    ref,
  ) => {
    const classes = useStyles();

    const subheader = title && (
      <ListSubheader className={classes.listSubheader}>{title}</ListSubheader>
    );

    return (
      <div className={classes.root}>
        <AutoSizer>
          {({ width, height }) => (
            <List
              ref={ref}
              width={width}
              height={height}
              itemCount={suggestions.length}
              itemSize={24}
            >
              {({ key, index, style }) => (
                <ListItem
                  key={key}
                  onClick={onClickItem(index)}
                  selected={suggestionIndex === index}
                  style={style}
                >
                  <ListItemText>{suggestions[index]} </ListItemText>
                </ListItem>
              )}
            </List>
          )}
        </AutoSizer>
      </div>
    );
  },
);

SuggestionMenu.propTypes = propTypes;
SuggestionMenu.defaultProps = defaultProps;

export default SuggestionMenu;
