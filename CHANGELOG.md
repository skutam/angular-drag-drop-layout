# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.1.1 - 2024-09-08

### Bug Fixes

* Changed the priority of preventDefault ([#26](https://github.com/skutam/angular-drag-drop-layout/pull/26)) ([72992fa](https://github.com/skutam/angular-drag-drop-layout/commit/72992faac59f9117978fc1a523cd80ac121c68fe))

## 1.1.0 - 2024-09-07

### Features

* Added draggable, resizable, disabled options to items ([#22](https://github.com/skutam/angular-drag-drop-layout/pull/22)) ([6997c86](https://github.com/skutam/angular-drag-drop-layout/commit/6997c86e47317b0204b961231d8cb2158a659926))

### Bug Fixes

* Passing data, fixed draggable conditions ([#24](https://github.com/skutam/angular-drag-drop-layout/pull/24)) ([20e179c](https://github.com/skutam/angular-drag-drop-layout/commit/20e179ce9dbeb1d3c92ecc6b4d4d66415885db80))


## 1.0.0 - 2024-08-25

### Features

* Added support for resize on all axis ([#1](https://github.com/skutam/angular-drag-drop-layout/issues/1)) ([b366a1d](https://github.com/skutam/angular-drag-drop-layout/commit/b366a1d9039703eb0b50cb1818cc0898fc7cf8e8))
* Drag item into grid ([#2](https://github.com/skutam/angular-drag-drop-layout/issues/2)) ([26a54f1](https://github.com/skutam/angular-drag-drop-layout/commit/26a54f1c993624b7b87795af53752564ee753305))
* Drag n drop of drag-items, also done dragging between grids ([7d2c6d2](https://github.com/skutam/angular-drag-drop-layout/commit/7d2c6d2b01324fc8b297432297cd52396eacc830))

### Bug Fixes

* Fixed calculation of offset when dragging in grid and resizing ([08b0cd5](https://github.com/skutam/angular-drag-drop-layout/commit/08b0cd57c2dbf9f25e44f80ae23ee32fc332f2b2))
* Fix click trigger item drag ([ebe0e9e](https://github.com/skutam/angular-drag-drop-layout/commit/8be0e9e6cd18877c585a439740182e6c450e56d9))
* Fixed bug where the placeholder was 0,0 in size. Removed unused properties ([7ce348d](https://github.com/skutam/angular-drag-drop-layout/commit/7ce348db15d446f289b3b1a4f8df482242523081))
* Fixed visual bug on first drag into grid where it would show the item in different position in first frame ([ef09a91](https://github.com/skutam/angular-drag-drop-layout/commit/ef09a911b301ae3dcb82a0da6ec2b3fe83dc4214))
