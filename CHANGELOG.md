# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.3.1](https://github.com/skutam/angular-drag-drop-layout/compare/v1.3.0...v1.3.1) (2025-09-18)


### Bug Fixes

* Placeholder 2x2px size in default state ([#50](https://github.com/skutam/angular-drag-drop-layout/issues/50)) ([1b3069e](https://github.com/skutam/angular-drag-drop-layout/commit/1b3069e9d993793d758c20c4b10b6e62d7a4ac27))

## [1.3.0](https://github.com/skutam/angular-drag-drop-layout/compare/v1.2.1...v1.3.0) (2025-01-26)


### Bug Fixes

* Automatic adding of item to the grid ([#46](https://github.com/skutam/angular-drag-drop-layout/issues/46)) ([12ab63b](https://github.com/skutam/angular-drag-drop-layout/commit/12ab63bbde5fa4541bec76f45075d649c06b90d1))
* Type errors ([#46](https://github.com/skutam/angular-drag-drop-layout/issues/46)) ([699384d](https://github.com/skutam/angular-drag-drop-layout/commit/699384dfa61607829d3246bf027337feddbbcd2d))

### [1.2.1](https://github.com/skutam/angular-drag-drop-layout/compare/v1.2.0...v1.2.1) (2024-12-11)


### Bug Fixes

* Fix placeholder calculation with new dynamic row height ([#42](https://github.com/skutam/angular-drag-drop-layout/issues/42)) ([26c0cb2](https://github.com/skutam/angular-drag-drop-layout/commit/26c0cb2ae9b25c382e7c6504c4e4436662d766dc))
* Fix resize, drag issue. Add scroll element support ([#40](https://github.com/skutam/angular-drag-drop-layout/issues/40)) ([7765dc5](https://github.com/skutam/angular-drag-drop-layout/commit/7765dc5f10ac2f032f1a0e8dd69959c116eadf41))

## [1.2.0](https://github.com/skutam/angular-drag-drop-layout/compare/v1.1.1...v1.2.0) (2024-12-03)


### Features

* Add support for scrolling on window element ([#32](https://github.com/skutam/angular-drag-drop-layout/issues/32)) ([6ad3679](https://github.com/skutam/angular-drag-drop-layout/commit/6ad3679c4a3a31aba1b4c4c9ebd2467bfe73c278))
* Dynamic grid height, resize recalculation ([#28](https://github.com/skutam/angular-drag-drop-layout/issues/28)) ([d5e9170](https://github.com/skutam/angular-drag-drop-layout/commit/d5e917081eb6290b5e97b385b889389e63099a6b))
* Enhanced col and row gaps, to support more types of units ([#30](https://github.com/skutam/angular-drag-drop-layout/issues/30)) ([08d7788](https://github.com/skutam/angular-drag-drop-layout/commit/08d7788157d6c0d16e545d2388130e4a7b45f07b))


### Bug Fixes

* Fixed the DEMO page height setting bug ([#35](https://github.com/skutam/angular-drag-drop-layout/issues/35)) ([d676a21](https://github.com/skutam/angular-drag-drop-layout/commit/d676a21d3603bec976e0acb3846bc69d3af3eeda))

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
