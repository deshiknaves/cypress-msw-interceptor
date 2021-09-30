#!/bin/bash

# Source utilities
source ./scripts/utilities.sh

BRANCH=feature/graphql

# Disable the ssh-agent
export SSH_AUTH_SOCK=none

# Tell ssh to use the specific SSH key
EMPTY_STRING=""
export GIT_SSH_COMMAND="ssh -i ~/.ssh/id_rsa_${SSH_FINGERPRINT//[:]$EMPTY_STRING}"

git checkout $BRANCH
exit_if_error "unable to checkout ${BRANCH}"

# Create a new version of the application
./scripts/version.js
exit_if_error "unable to update version"

export VERSION=v$(jq -r '.version' package.json)

# Push the chagnes
git push origin ${BRANCH}
exit_if_error "unable to push to ${BRANCH}"
git push origin ${VERSION}
exit_if_error "unable to push tag ${VERSION}"

# Build production bundle
CI=true yarn build
exit_if_error "unable to build package"

# Publish package to npm
# yarn publish