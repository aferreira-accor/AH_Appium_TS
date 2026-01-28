#!/bin/bash
# Workaround: WDIO injects tsx into NODE_OPTIONS, which crashes appium
# on ESM-only transitive dependencies (unicorn-magic via @appium/docutils).
# This wrapper strips NODE_OPTIONS so appium starts with a clean environment.
unset NODE_OPTIONS
exec appium "$@"
