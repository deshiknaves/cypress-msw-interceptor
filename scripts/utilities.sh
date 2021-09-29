#!/bin/bash

function exit_if_error {
  if [[ $? -ne 0 ]]; then
    echo "ERROR: ${1}"
    exit 1
  fi
}

SEMVER_REGEX="^v?(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(\\-[0-9A-Za-z-]+(\\.[0-9A-Za-z-]+)*)?(\\+[0-9A-Za-z-]+(\\.[0-9A-Za-z-]+)*)?$"


function validate-version {
  local version=$1
  if [[ "$version" =~ $SEMVER_REGEX ]]; then
    if [ "$#" -eq "2" ]; then
      local major=${BASH_REMATCH[1]}
      local minor=${BASH_REMATCH[2]}
      local patch=${BASH_REMATCH[3]}
      local prere=${BASH_REMATCH[4]}
      local build=${BASH_REMATCH[5]}
      eval "$2=(\"$major\" \"$minor\" \"$patch\")"
    else
      echo "$version"
    fi
  else
    echo "version $version does not match the semver scheme 'X.Y.Z'. See help for more information."
    exit 1
  fi
}