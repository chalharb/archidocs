# Changelog

## [1.4.0](https://github.com/chalharb/archidocs/compare/v1.3.3...v1.4.0) (2026-11-27)

### Features

* **deployments:** show scaled Deployments as a stack with a count chip ([654d3cb](https://github.com/chalharb/archidocs/commit/654d3cb8db3fd610435735294765a691b92b190a))
* **gaps:** list_gaps MCP tool and archidocs gaps command ([7337f06](https://github.com/chalharb/archidocs/commit/7337f06d718452c903804a5db6c71160e8769970))
* **gaps:** list_gaps MCP tool and archidocs gaps command ([#139](https://github.com/chalharb/archidocs/issues/139)) ([d755813](https://github.com/chalharb/archidocs/commit/d75581336b54cacb67e27f4fdd1bfe496fe72d3f))
* **guide:** consult skill for checking the Model while changing code ([ef9f9de](https://github.com/chalharb/archidocs/commit/ef9f9de3afc59dc74bebd5c7b6eb8bdcef5274da))
* **guide:** consult skill for checking the Model while changing code ([#143](https://github.com/chalharb/archidocs/issues/143)) ([388d7ad](https://github.com/chalharb/archidocs/commit/388d7adf6ecd8870f39a013019fea38cfe4309e0))
* **guide:** describe skill builds the Model from the user's prose ([83cfdb8](https://github.com/chalharb/archidocs/commit/83cfdb8507b1d9d9ada26367fa5a23cdc5e2a113))
* **guide:** describe skill builds the Model from the user's prose ([#141](https://github.com/chalharb/archidocs/issues/141)) ([cac9641](https://github.com/chalharb/archidocs/commit/cac9641656d412f9cdf47af1a3a562619054626d))
* **guide:** fill-gaps is a skill of its own, scanning with list_gaps ([e9fe27d](https://github.com/chalharb/archidocs/commit/e9fe27da346504dd99ca98d81e335e12e3f3a8c7))
* **guide:** fill-gaps is a skill of its own, scanning with list_gaps ([#142](https://github.com/chalharb/archidocs/issues/142)) ([fa3e34c](https://github.com/chalharb/archidocs/commit/fa3e34c2de2a1af1336d1e67de90f7a779338fba))
* **guide:** load any skill's guide with get_guide and guide --skill ([2c79f21](https://github.com/chalharb/archidocs/commit/2c79f21d926c702ee00c99ad26260765bea2d334))
* **guide:** load any skill's guide with get_guide and guide --skill ([#140](https://github.com/chalharb/archidocs/issues/140)) ([2ab6963](https://github.com/chalharb/archidocs/commit/2ab696343a6451d55619c015609c78dc9a3ea42e))
* **model:** Element repository and metadata, structured Element panel ([#133](https://github.com/chalharb/archidocs/issues/133)) ([7a1fcb1](https://github.com/chalharb/archidocs/commit/7a1fcb17b1d5f5c0a93009d7f25b2014d4386e4b))
* **model:** give Elements a repository and free-form metadata, and lay them out in the Element panel ([f5776ee](https://github.com/chalharb/archidocs/commit/f5776eedee32b7c33f644fdcaed24468089830fb))
* **viewer:** export a Dynamic View as SVG or PNG ([252a051](https://github.com/chalharb/archidocs/commit/252a051e1be700e5e337ca5f3ddf831946d2f73d))
* **viewer:** fold the Key by default and explain the View's icons ([8f8ebe3](https://github.com/chalharb/archidocs/commit/8f8ebe3070ee540532052dd9764c86e5080c5a43))
* **viewer:** light a hovered edge and its two ends ([6feb3fd](https://github.com/chalharb/archidocs/commit/6feb3fd253099ca52d8acc7175d389e609f42563))
* **viewer:** shade nested Deployment Targets by depth ([d689087](https://github.com/chalharb/archidocs/commit/d6890875d8b120a02ad5908c271a4b50624a0a79))
* **viewer:** show an edge's Relationships in a sidebar ([380e8cd](https://github.com/chalharb/archidocs/commit/380e8cd1711eb393354721f4644c53b4dbeb6cdf))
* **viewer:** show an edge's Relationships in a sidebar ([#132](https://github.com/chalharb/archidocs/issues/132)) ([ee01e30](https://github.com/chalharb/archidocs/commit/ee01e307cd0109acd2adbec31efd71aa512a556a))
* **views:** open every System on the C2 Landscape, and drill down from C1 one level ([aa1f507](https://github.com/chalharb/archidocs/commit/aa1f507b1f0503b00738f97b447898560b69385d))

### Bug fixes

* **dev:** batch rebuilds and swap the Bundle in place ([2cfc90a](https://github.com/chalharb/archidocs/commit/2cfc90ac79be13c921eee92fd538604f6681aaa9))
* **dev:** close idle keep-alive sockets when the dev server closes ([943e31d](https://github.com/chalharb/archidocs/commit/943e31d490b50e347a6d16327aa93b08fed59a98))
* **render:** orient arrowheads with plain auto ([d9446fa](https://github.com/chalharb/archidocs/commit/d9446fa1b259916b602b841f9a9659ab9a0cfa92))
* **render:** orient arrowheads with plain auto ([#131](https://github.com/chalharb/archidocs/issues/131)) ([f48e0df](https://github.com/chalharb/archidocs/commit/f48e0df8e2413c6180de6f35b03c2391eb32686a))
* **render:** size sequence headers to fit their whole names ([0ce963d](https://github.com/chalharb/archidocs/commit/0ce963d8acebdd31606c2e363e434b7dffb40daf))
* **viewer:** draw edges over open boxes so they can be hovered ([f667520](https://github.com/chalharb/archidocs/commit/f6675201facdd7953e9d3f862c93cf2b3fe4880f))
* **viewer:** open the C1 Landscape as home ([8fe6a90](https://github.com/chalharb/archidocs/commit/8fe6a90837e70b11e4986e7698be20b8d47ebbf6))
* **viewer:** orient the canvas's arrowheads with plain auto ([6789b88](https://github.com/chalharb/archidocs/commit/6789b884103e8d0c82cc7900f80e54e04c677b20))
* **viewer:** remember the Key's toggle as the click lands ([7e2526f](https://github.com/chalharb/archidocs/commit/7e2526fd8265b53caa0d1b8efcd6c957f1de1323))
* **writer:** read no YAML style from a block scalar's text ([47297ee](https://github.com/chalharb/archidocs/commit/47297ee7e9e4228c7c14b7f0a46ebedd62362c96))

## [1.3.3](https://github.com/chalharb/archidocs/compare/v1.3.2...v1.3.3) (2026-11-26)

### Bug fixes

* **dev:** batch rebuilds and swap the Bundle in place ([6f87a53](https://github.com/chalharb/archidocs/commit/6f87a536ec0702aaf6cb232b1970a6b412c2f233))
* **viewer:** open the C1 Landscape as home ([7f1f367](https://github.com/chalharb/archidocs/commit/7f1f36766a2c7b944f16a87e9623874a91227b63))

## [1.3.2](https://github.com/chalharb/archidocs/compare/v1.3.1...v1.3.2) (2026-11-26)


### Bug fixes

* **init:** write commands that run without a global install ([#104](https://github.com/chalharb/archidocs/issues/104)) ([c8b4af6](https://github.com/chalharb/archidocs/commit/c8b4af66a5baa393affafde09c490b5242c602f1))

## [1.3.1](https://github.com/chalharb/archidocs/compare/v1.3.0...v1.3.1) (2026-11-26)


### Bug fixes

* **dev:** reload only when a Workspace file changes ([#92](https://github.com/chalharb/archidocs/issues/92)) ([b69cfb8](https://github.com/chalharb/archidocs/commit/b69cfb8d111eab59b8df7f863a56b7117303edef))
* **examples:** build-demo only replaces an empty folder or an earlier site ([#102](https://github.com/chalharb/archidocs/issues/102)) ([4343c52](https://github.com/chalharb/archidocs/commit/4343c521cb41aa5e92cade63b8b04bf3b0614748))
* **history:** a date on a checkout names the last Revision ([#97](https://github.com/chalharb/archidocs/issues/97)) ([c52a9f1](https://github.com/chalharb/archidocs/commit/c52a9f112158f1f0a6036635214826288d86ef52))
* **history:** one point grammar for the viewer and MCP on a site ([#94](https://github.com/chalharb/archidocs/issues/94)) ([0dc94bf](https://github.com/chalharb/archidocs/commit/0dc94bfbbffc34eccb76d2ed9573a856c8e4a992))
* **history:** one site reader for MCP and the viewer ([#98](https://github.com/chalharb/archidocs/issues/98)) ([198598b](https://github.com/chalharb/archidocs/commit/198598b2dad1999cc720590b19a1cf3e50254694))

## [1.3.0](https://github.com/chalharb/archidocs/compare/v1.2.0...v1.3.0) (2026-11-25)


### Features

* **check:** say why each rule exists and what check prints ([#64](https://github.com/chalharb/archidocs/issues/64)) ([9355bfe](https://github.com/chalharb/archidocs/commit/9355bfeb4c3dcd5e18dd8b253226f8f49ea4c091))
* **cli:** examples and exit codes for every command ([#66](https://github.com/chalharb/archidocs/issues/66)) ([8522d45](https://github.com/chalharb/archidocs/commit/8522d45dbebe9b53826354e55c1102f102178fb0))
* **schema:** describe every Model YAML field ([#68](https://github.com/chalharb/archidocs/issues/68)) ([bc02bab](https://github.com/chalharb/archidocs/commit/bc02bab2b41fcb8b0d483fe91581d07857ba652f))
* **viewer:** one list of URL parameters, and a generated viewer URL reference ([#73](https://github.com/chalharb/archidocs/issues/73)) ([d1af7a1](https://github.com/chalharb/archidocs/commit/d1af7a1ebff47d09bc0058c170c5756ade37c224))
* **viewer:** size boxes to their names, add a visible way in, reflow the plate ([#57](https://github.com/chalharb/archidocs/issues/57)) ([14092f1](https://github.com/chalharb/archidocs/commit/14092f1e3fc128c710834ce22ca16a7406dd2753))
* **website:** a page per MCP tool, with a real example ([#74](https://github.com/chalharb/archidocs/issues/74)) ([2a491fc](https://github.com/chalharb/archidocs/commit/2a491fcabcc17d02e8978ada20074e053bc728e4))
* **website:** a quick start that reaches a result ([#67](https://github.com/chalharb/archidocs/issues/67)) ([c1c8299](https://github.com/chalharb/archidocs/commit/c1c829954366e7e25bd32c2ad512b499adbef59e))
* **website:** docs home cards, group index pages and last-updated dates ([#65](https://github.com/chalharb/archidocs/issues/65)) ([86c5e21](https://github.com/chalharb/archidocs/commit/86c5e2178fa3c70bc470ffcb091a21c2524aa2cf))
* **website:** generated screenshots of the viewer ([#71](https://github.com/chalharb/archidocs/issues/71)) ([7a5a07f](https://github.com/chalharb/archidocs/commit/7a5a07f2fae4b6eec71a30a316de1fd906097f0f))


### Bug fixes

* **views:** direction always set, explicit Lens option, one Lens wording; viewer uses the View module ([#69](https://github.com/chalharb/archidocs/issues/69)) ([c2dade8](https://github.com/chalharb/archidocs/commit/c2dade86b2019fc570109299773966cea50baa27))

## [1.2.0](https://github.com/chalharb/archidocs/compare/v1.1.0...v1.2.0) (2026-11-24)


### Features

* **website:** branded link previews ([#54](https://github.com/chalharb/archidocs/issues/54)) ([457d69f](https://github.com/chalharb/archidocs/commit/457d69f3238e106953c4035f8fa470fad74f3dd2))


### Bug fixes

* **package:** name the repository so npm accepts provenance ([#55](https://github.com/chalharb/archidocs/issues/55)) ([9853f06](https://github.com/chalharb/archidocs/commit/9853f069f8f9d25d27fc6863f178fbdca7d1d7d2))

## [1.1.0](https://github.com/chalharb/archidocs/compare/v1.0.0...v1.1.0) (2026-11-24)


### Features

* **check:** link each rule to its docs page ([#44](https://github.com/chalharb/archidocs/issues/44)) ([e536632](https://github.com/chalharb/archidocs/commit/e536632ee3b32a0c846ac58670897ceee324e788))
* **cli:** structured command definitions ([#45](https://github.com/chalharb/archidocs/issues/45)) ([a21632f](https://github.com/chalharb/archidocs/commit/a21632f78b0e591e699ad7e5754fb5acc750c384))
* **export:** embed Overpass to match the viewer ([#47](https://github.com/chalharb/archidocs/issues/47)) ([3308bcd](https://github.com/chalharb/archidocs/commit/3308bcdc4e9026bd5d4a730a183ef3dc37cea5fe))
* **export:** Wayfinding Plate styling, --theme and --label ([#46](https://github.com/chalharb/archidocs/issues/46)) ([6444ae4](https://github.com/chalharb/archidocs/commit/6444ae4a43c8f7d03bf3359f34fffc728c74a372))
* **viewer:** hint to start typing in an empty Find panel ([#40](https://github.com/chalharb/archidocs/issues/40)) ([c2f6975](https://github.com/chalharb/archidocs/commit/c2f69750e2d6108822cb5af5c31c7c7e3cf64cdc))
* **website:** landing page ([#51](https://github.com/chalharb/archidocs/issues/51)) ([c8f3b49](https://github.com/chalharb/archidocs/commit/c8f3b49bf322315c34a0780b543b13ea33c3da04))
* **website:** Starlight scaffold and generated reference ([#50](https://github.com/chalharb/archidocs/issues/50)) ([b70fffd](https://github.com/chalharb/archidocs/commit/b70fffd28efb47e755420e224b6e52e57afbd6c4))
