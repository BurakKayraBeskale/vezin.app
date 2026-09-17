"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "app/api/auth/[...nextauth]/route";
exports.ids = ["app/api/auth/[...nextauth]/route"];
exports.modules = {

/***/ "@prisma/client":
/*!*********************************!*\
  !*** external "@prisma/client" ***!
  \*********************************/
/***/ ((module) => {

module.exports = require("@prisma/client");

/***/ }),

/***/ "../../client/components/action-async-storage.external":
/*!*******************************************************************************!*\
  !*** external "next/dist/client/components/action-async-storage.external.js" ***!
  \*******************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/client/components/action-async-storage.external.js");

/***/ }),

/***/ "../../client/components/request-async-storage.external":
/*!********************************************************************************!*\
  !*** external "next/dist/client/components/request-async-storage.external.js" ***!
  \********************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/client/components/request-async-storage.external.js");

/***/ }),

/***/ "../../client/components/static-generation-async-storage.external":
/*!******************************************************************************************!*\
  !*** external "next/dist/client/components/static-generation-async-storage.external.js" ***!
  \******************************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/client/components/static-generation-async-storage.external.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-page.runtime.dev.js":
/*!*************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-page.runtime.dev.js" ***!
  \*************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/compiled/next-server/app-page.runtime.dev.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-route.runtime.dev.js":
/*!**************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-route.runtime.dev.js" ***!
  \**************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/compiled/next-server/app-route.runtime.dev.js");

/***/ }),

/***/ "assert":
/*!*************************!*\
  !*** external "assert" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("assert");

/***/ }),

/***/ "buffer":
/*!*************************!*\
  !*** external "buffer" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("buffer");

/***/ }),

/***/ "crypto":
/*!*************************!*\
  !*** external "crypto" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),

/***/ "events":
/*!*************************!*\
  !*** external "events" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("events");

/***/ }),

/***/ "http":
/*!***********************!*\
  !*** external "http" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("http");

/***/ }),

/***/ "https":
/*!************************!*\
  !*** external "https" ***!
  \************************/
/***/ ((module) => {

module.exports = require("https");

/***/ }),

/***/ "querystring":
/*!******************************!*\
  !*** external "querystring" ***!
  \******************************/
/***/ ((module) => {

module.exports = require("querystring");

/***/ }),

/***/ "url":
/*!**********************!*\
  !*** external "url" ***!
  \**********************/
/***/ ((module) => {

module.exports = require("url");

/***/ }),

/***/ "util":
/*!***********************!*\
  !*** external "util" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("util");

/***/ }),

/***/ "zlib":
/*!***********************!*\
  !*** external "zlib" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("zlib");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute&page=%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute.ts&appDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!":
/*!************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute&page=%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute.ts&appDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D! ***!
  \************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   originalPathname: () => (/* binding */ originalPathname),\n/* harmony export */   patchFetch: () => (/* binding */ patchFetch),\n/* harmony export */   requestAsyncStorage: () => (/* binding */ requestAsyncStorage),\n/* harmony export */   routeModule: () => (/* binding */ routeModule),\n/* harmony export */   serverHooks: () => (/* binding */ serverHooks),\n/* harmony export */   staticGenerationAsyncStorage: () => (/* binding */ staticGenerationAsyncStorage)\n/* harmony export */ });\n/* harmony import */ var next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/server/future/route-modules/app-route/module.compiled */ \"(rsc)/./node_modules/next/dist/server/future/route-modules/app-route/module.compiled.js\");\n/* harmony import */ var next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/future/route-kind */ \"(rsc)/./node_modules/next/dist/server/future/route-kind.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/server/lib/patch-fetch */ \"(rsc)/./node_modules/next/dist/server/lib/patch-fetch.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var C_Users_Kullan_c_vezin_app_app_api_auth_nextauth_route_ts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./app/api/auth/[...nextauth]/route.ts */ \"(rsc)/./app/api/auth/[...nextauth]/route.ts\");\n\n\n\n\n// We inject the nextConfigOutput here so that we can use them in the route\n// module.\nconst nextConfigOutput = \"\"\nconst routeModule = new next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__.AppRouteRouteModule({\n    definition: {\n        kind: next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind.APP_ROUTE,\n        page: \"/api/auth/[...nextauth]/route\",\n        pathname: \"/api/auth/[...nextauth]\",\n        filename: \"route\",\n        bundlePath: \"app/api/auth/[...nextauth]/route\"\n    },\n    resolvedPagePath: \"C:\\\\Users\\\\Kullanıcı\\\\vezin-app\\\\app\\\\api\\\\auth\\\\[...nextauth]\\\\route.ts\",\n    nextConfigOutput,\n    userland: C_Users_Kullan_c_vezin_app_app_api_auth_nextauth_route_ts__WEBPACK_IMPORTED_MODULE_3__\n});\n// Pull out the exports that we need to expose from the module. This should\n// be eliminated when we've moved the other routes to the new format. These\n// are used to hook into the route.\nconst { requestAsyncStorage, staticGenerationAsyncStorage, serverHooks } = routeModule;\nconst originalPathname = \"/api/auth/[...nextauth]/route\";\nfunction patchFetch() {\n    return (0,next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__.patchFetch)({\n        serverHooks,\n        staticGenerationAsyncStorage\n    });\n}\n\n\n//# sourceMappingURL=app-route.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvbmV4dC9kaXN0L2J1aWxkL3dlYnBhY2svbG9hZGVycy9uZXh0LWFwcC1sb2FkZXIuanM/bmFtZT1hcHAlMkZhcGklMkZhdXRoJTJGJTVCLi4ubmV4dGF1dGglNUQlMkZyb3V0ZSZwYWdlPSUyRmFwaSUyRmF1dGglMkYlNUIuLi5uZXh0YXV0aCU1RCUyRnJvdXRlJmFwcFBhdGhzPSZwYWdlUGF0aD1wcml2YXRlLW5leHQtYXBwLWRpciUyRmFwaSUyRmF1dGglMkYlNUIuLi5uZXh0YXV0aCU1RCUyRnJvdXRlLnRzJmFwcERpcj1DJTNBJTVDVXNlcnMlNUNLdWxsYW4lQzQlQjFjJUM0JUIxJTVDdmV6aW4tYXBwJTVDYXBwJnBhZ2VFeHRlbnNpb25zPXRzeCZwYWdlRXh0ZW5zaW9ucz10cyZwYWdlRXh0ZW5zaW9ucz1qc3gmcGFnZUV4dGVuc2lvbnM9anMmcm9vdERpcj1DJTNBJTVDVXNlcnMlNUNLdWxsYW4lQzQlQjFjJUM0JUIxJTVDdmV6aW4tYXBwJmlzRGV2PXRydWUmdHNjb25maWdQYXRoPXRzY29uZmlnLmpzb24mYmFzZVBhdGg9JmFzc2V0UHJlZml4PSZuZXh0Q29uZmlnT3V0cHV0PSZwcmVmZXJyZWRSZWdpb249Jm1pZGRsZXdhcmVDb25maWc9ZTMwJTNEISIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUFBc0c7QUFDdkM7QUFDYztBQUN3QjtBQUNyRztBQUNBO0FBQ0E7QUFDQSx3QkFBd0IsZ0hBQW1CO0FBQzNDO0FBQ0EsY0FBYyx5RUFBUztBQUN2QjtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0EsWUFBWTtBQUNaLENBQUM7QUFDRDtBQUNBO0FBQ0E7QUFDQSxRQUFRLGlFQUFpRTtBQUN6RTtBQUNBO0FBQ0EsV0FBVyw0RUFBVztBQUN0QjtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ3VIOztBQUV2SCIsInNvdXJjZXMiOlsid2VicGFjazovL3ZlemluLWFwcC8/NzIzMSJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcHBSb3V0ZVJvdXRlTW9kdWxlIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvZnV0dXJlL3JvdXRlLW1vZHVsZXMvYXBwLXJvdXRlL21vZHVsZS5jb21waWxlZFwiO1xuaW1wb3J0IHsgUm91dGVLaW5kIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvZnV0dXJlL3JvdXRlLWtpbmRcIjtcbmltcG9ydCB7IHBhdGNoRmV0Y2ggYXMgX3BhdGNoRmV0Y2ggfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9saWIvcGF0Y2gtZmV0Y2hcIjtcbmltcG9ydCAqIGFzIHVzZXJsYW5kIGZyb20gXCJDOlxcXFxVc2Vyc1xcXFxLdWxsYW7EsWPEsVxcXFx2ZXppbi1hcHBcXFxcYXBwXFxcXGFwaVxcXFxhdXRoXFxcXFsuLi5uZXh0YXV0aF1cXFxccm91dGUudHNcIjtcbi8vIFdlIGluamVjdCB0aGUgbmV4dENvbmZpZ091dHB1dCBoZXJlIHNvIHRoYXQgd2UgY2FuIHVzZSB0aGVtIGluIHRoZSByb3V0ZVxuLy8gbW9kdWxlLlxuY29uc3QgbmV4dENvbmZpZ091dHB1dCA9IFwiXCJcbmNvbnN0IHJvdXRlTW9kdWxlID0gbmV3IEFwcFJvdXRlUm91dGVNb2R1bGUoe1xuICAgIGRlZmluaXRpb246IHtcbiAgICAgICAga2luZDogUm91dGVLaW5kLkFQUF9ST1VURSxcbiAgICAgICAgcGFnZTogXCIvYXBpL2F1dGgvWy4uLm5leHRhdXRoXS9yb3V0ZVwiLFxuICAgICAgICBwYXRobmFtZTogXCIvYXBpL2F1dGgvWy4uLm5leHRhdXRoXVwiLFxuICAgICAgICBmaWxlbmFtZTogXCJyb3V0ZVwiLFxuICAgICAgICBidW5kbGVQYXRoOiBcImFwcC9hcGkvYXV0aC9bLi4ubmV4dGF1dGhdL3JvdXRlXCJcbiAgICB9LFxuICAgIHJlc29sdmVkUGFnZVBhdGg6IFwiQzpcXFxcVXNlcnNcXFxcS3VsbGFuxLFjxLFcXFxcdmV6aW4tYXBwXFxcXGFwcFxcXFxhcGlcXFxcYXV0aFxcXFxbLi4ubmV4dGF1dGhdXFxcXHJvdXRlLnRzXCIsXG4gICAgbmV4dENvbmZpZ091dHB1dCxcbiAgICB1c2VybGFuZFxufSk7XG4vLyBQdWxsIG91dCB0aGUgZXhwb3J0cyB0aGF0IHdlIG5lZWQgdG8gZXhwb3NlIGZyb20gdGhlIG1vZHVsZS4gVGhpcyBzaG91bGRcbi8vIGJlIGVsaW1pbmF0ZWQgd2hlbiB3ZSd2ZSBtb3ZlZCB0aGUgb3RoZXIgcm91dGVzIHRvIHRoZSBuZXcgZm9ybWF0LiBUaGVzZVxuLy8gYXJlIHVzZWQgdG8gaG9vayBpbnRvIHRoZSByb3V0ZS5cbmNvbnN0IHsgcmVxdWVzdEFzeW5jU3RvcmFnZSwgc3RhdGljR2VuZXJhdGlvbkFzeW5jU3RvcmFnZSwgc2VydmVySG9va3MgfSA9IHJvdXRlTW9kdWxlO1xuY29uc3Qgb3JpZ2luYWxQYXRobmFtZSA9IFwiL2FwaS9hdXRoL1suLi5uZXh0YXV0aF0vcm91dGVcIjtcbmZ1bmN0aW9uIHBhdGNoRmV0Y2goKSB7XG4gICAgcmV0dXJuIF9wYXRjaEZldGNoKHtcbiAgICAgICAgc2VydmVySG9va3MsXG4gICAgICAgIHN0YXRpY0dlbmVyYXRpb25Bc3luY1N0b3JhZ2VcbiAgICB9KTtcbn1cbmV4cG9ydCB7IHJvdXRlTW9kdWxlLCByZXF1ZXN0QXN5bmNTdG9yYWdlLCBzdGF0aWNHZW5lcmF0aW9uQXN5bmNTdG9yYWdlLCBzZXJ2ZXJIb29rcywgb3JpZ2luYWxQYXRobmFtZSwgcGF0Y2hGZXRjaCwgIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWFwcC1yb3V0ZS5qcy5tYXAiXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute&page=%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute.ts&appDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!\n");

/***/ }),

/***/ "(rsc)/./app/api/auth/[...nextauth]/route.ts":
/*!*********************************************!*\
  !*** ./app/api/auth/[...nextauth]/route.ts ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   GET: () => (/* binding */ handler),\n/* harmony export */   POST: () => (/* binding */ handler)\n/* harmony export */ });\n/* harmony import */ var next_auth__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next-auth */ \"(rsc)/./node_modules/next-auth/index.js\");\n/* harmony import */ var next_auth__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_auth__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _lib_auth__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @/lib/auth */ \"(rsc)/./lib/auth.ts\");\n\n\nconst handler = next_auth__WEBPACK_IMPORTED_MODULE_0___default()(_lib_auth__WEBPACK_IMPORTED_MODULE_1__.authOptions);\n\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9hcHAvYXBpL2F1dGgvWy4uLm5leHRhdXRoXS9yb3V0ZS50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFpQztBQUNRO0FBRXpDLE1BQU1FLFVBQVVGLGdEQUFRQSxDQUFDQyxrREFBV0E7QUFDTyIsInNvdXJjZXMiOlsid2VicGFjazovL3ZlemluLWFwcC8uL2FwcC9hcGkvYXV0aC9bLi4ubmV4dGF1dGhdL3JvdXRlLnRzP2M4YTQiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IE5leHRBdXRoIGZyb20gXCJuZXh0LWF1dGhcIjtcbmltcG9ydCB7IGF1dGhPcHRpb25zIH0gZnJvbSBcIkAvbGliL2F1dGhcIjtcblxuY29uc3QgaGFuZGxlciA9IE5leHRBdXRoKGF1dGhPcHRpb25zKTtcbmV4cG9ydCB7IGhhbmRsZXIgYXMgR0VULCBoYW5kbGVyIGFzIFBPU1QgfTtcbiJdLCJuYW1lcyI6WyJOZXh0QXV0aCIsImF1dGhPcHRpb25zIiwiaGFuZGxlciIsIkdFVCIsIlBPU1QiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./app/api/auth/[...nextauth]/route.ts\n");

/***/ }),

/***/ "(rsc)/./lib/auth.ts":
/*!*********************!*\
  !*** ./lib/auth.ts ***!
  \*********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   authOptions: () => (/* binding */ authOptions)\n/* harmony export */ });\n/* harmony import */ var next_auth_providers_credentials__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next-auth/providers/credentials */ \"(rsc)/./node_modules/next-auth/providers/credentials.js\");\n/* harmony import */ var _prisma__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./prisma */ \"(rsc)/./lib/prisma.ts\");\n/* harmony import */ var bcryptjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! bcryptjs */ \"(rsc)/./node_modules/bcryptjs/index.js\");\n/* harmony import */ var bcryptjs__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(bcryptjs__WEBPACK_IMPORTED_MODULE_2__);\n\n\n\nconst authOptions = {\n    providers: [\n        (0,next_auth_providers_credentials__WEBPACK_IMPORTED_MODULE_0__[\"default\"])({\n            name: \"Credentials\",\n            credentials: {\n                email: {\n                    label: \"E-posta\",\n                    type: \"email\"\n                },\n                password: {\n                    label: \"Şifre\",\n                    type: \"password\"\n                }\n            },\n            async authorize (credentials, req) {\n                if (!credentials?.email || !credentials?.password) return null;\n                const rawIp = req?.headers?.[\"x-forwarded-for\"] ?? req?.headers?.[\"x-real-ip\"] ?? \"unknown\";\n                const ip = Array.isArray(rawIp) ? rawIp[0] : rawIp.split(\",\")[0].trim();\n                const userAgent = req?.headers?.[\"user-agent\"] ?? \"unknown\";\n                const user = await _prisma__WEBPACK_IMPORTED_MODULE_1__.prisma.user.findUnique({\n                    where: {\n                        email: credentials.email\n                    }\n                });\n                if (!user) {\n                    try {\n                        await _prisma__WEBPACK_IMPORTED_MODULE_1__.prisma.loginLog.create({\n                            data: {\n                                ip,\n                                userAgent,\n                                success: false\n                            }\n                        });\n                    } catch  {}\n                    return null;\n                }\n                // Pasif veya silinmiş hesaplar giriş yapamaz\n                if (user.status === \"INACTIVE\" || user.status === \"DELETED\") {\n                    try {\n                        await _prisma__WEBPACK_IMPORTED_MODULE_1__.prisma.loginLog.create({\n                            data: {\n                                userId: user.id,\n                                ip,\n                                userAgent,\n                                success: false\n                            }\n                        });\n                    } catch  {}\n                    return null;\n                }\n                const valid = await bcryptjs__WEBPACK_IMPORTED_MODULE_2___default().compare(credentials.password, user.password);\n                try {\n                    await _prisma__WEBPACK_IMPORTED_MODULE_1__.prisma.loginLog.create({\n                        data: {\n                            userId: user.id,\n                            ip,\n                            userAgent,\n                            success: valid\n                        }\n                    });\n                } catch  {}\n                if (!valid) return null;\n                return {\n                    id: user.id,\n                    name: user.name,\n                    email: user.email,\n                    role: user.role,\n                    department: user.department,\n                    mustChangePassword: user.mustChangePassword,\n                    canViewAllTasks: user.canViewAllTasks,\n                    seniorityLevel: user.seniorityLevel,\n                    status: user.status\n                };\n            }\n        })\n    ],\n    session: {\n        strategy: \"jwt\"\n    },\n    callbacks: {\n        async jwt ({ token, user, trigger, session }) {\n            if (user) {\n                token.id = user.id;\n            }\n            // Her token yenilemesinde DB'den güncel rol/departman/mustChangePassword çek\n            // → Panelden yapılan yetki değişikliği kullanıcı sayfa yenileyince anında yansır\n            if (token.id) {\n                try {\n                    const dbUser = await _prisma__WEBPACK_IMPORTED_MODULE_1__.prisma.user.findUnique({\n                        where: {\n                            id: token.id\n                        },\n                        select: {\n                            role: true,\n                            department: true,\n                            mustChangePassword: true,\n                            canViewAllTasks: true,\n                            seniorityLevel: true,\n                            canViewAllProjects: true,\n                            overseesDepartment: true,\n                            canManageCompanies: true,\n                            canAccessRotasyon: true,\n                            status: true\n                        }\n                    });\n                    if (dbUser) {\n                        token.role = dbUser.role;\n                        token.department = dbUser.department;\n                        token.mustChangePassword = dbUser.mustChangePassword ?? false;\n                        token.canViewAllTasks = dbUser.canViewAllTasks ?? false;\n                        token.seniorityLevel = dbUser.seniorityLevel ?? 0;\n                        token.canViewAllProjects = dbUser.canViewAllProjects ?? false;\n                        token.overseesDepartment = dbUser.overseesDepartment ?? null;\n                        token.canManageCompanies = dbUser.canManageCompanies ?? false;\n                        token.canAccessRotasyon = dbUser.canAccessRotasyon ?? false;\n                        token.status = dbUser.status ?? \"ACTIVE\";\n                    } else {\n                        // Kullanıcı DB'den silinmişse oturumu geçersiz say\n                        token.status = \"DELETED\";\n                    }\n                } catch  {\n                // DB erişim hatası olursa mevcut token değerleri korunur\n                }\n            }\n            // client-side session.update() ile mustChangePassword temizlenebilsin\n            if (trigger === \"update\" && session?.mustChangePassword !== undefined) {\n                token.mustChangePassword = session.mustChangePassword;\n            }\n            return token;\n        },\n        session ({ session, token }) {\n            if (session.user) {\n                session.user.id = token.id;\n                session.user.role = token.role;\n                session.user.department = token.department;\n                session.user.mustChangePassword = token.mustChangePassword;\n                session.user.canViewAllTasks = token.canViewAllTasks ?? false;\n                session.user.seniorityLevel = token.seniorityLevel ?? 0;\n                session.user.canViewAllProjects = token.canViewAllProjects ?? false;\n                session.user.overseesDepartment = token.overseesDepartment ?? null;\n                session.user.canManageCompanies = token.canManageCompanies ?? false;\n                session.user.canAccessRotasyon = token.canAccessRotasyon ?? false;\n            }\n            return session;\n        }\n    },\n    pages: {\n        signIn: \"/login\"\n    },\n    secret: process.env.NEXTAUTH_SECRET\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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RyxRQUFRSCxrQkFBa0I7WUFDdkQ7WUFDQSxPQUFPTztRQUNUO1FBQ0FKLFNBQVEsRUFBRUEsT0FBTyxFQUFFSSxLQUFLLEVBQUU7WUFDeEIsSUFBSUosUUFBUWpCLElBQUksRUFBRTtnQkFDZmlCLFFBQVFqQixJQUFJLENBQVNTLEVBQUUsR0FBR1ksTUFBTVosRUFBRTtnQkFDbENRLFFBQVFqQixJQUFJLENBQVNZLElBQUksR0FBR1MsTUFBTVQsSUFBSTtnQkFDdENLLFFBQVFqQixJQUFJLENBQVNhLFVBQVUsR0FBR1EsTUFBTVIsVUFBVTtnQkFDbERJLFFBQVFqQixJQUFJLENBQVNjLGtCQUFrQixHQUFHTyxNQUFNUCxrQkFBa0I7Z0JBQ2xFRyxRQUFRakIsSUFBSSxDQUFTZSxlQUFlLEdBQUdNLE1BQU1OLGVBQWUsSUFBZTtnQkFDM0VFLFFBQVFqQixJQUFJLENBQVNnQixjQUFjLEdBQUdLLE1BQU1MLGNBQWMsSUFBYztnQkFDeEVDLFFBQVFqQixJQUFJLENBQVN5QixrQkFBa0IsR0FBR0osTUFBTUksa0JBQWtCLElBQWU7Z0JBQ2pGUixRQUFRakIsSUFBSSxDQUFTMEIsa0JBQWtCLEdBQUdMLE1BQU1LLGtCQUFrQixJQUFxQjtnQkFDdkZULFFBQVFqQixJQUFJLENBQVMyQixrQkFBa0IsR0FBR04sTUFBTU0sa0JBQWtCLElBQWU7Z0JBQ2pGVixRQUFRakIsSUFBSSxDQUFTNEIsaUJBQWlCLEdBQUdQLE1BQU1PLGlCQUFpQixJQUFlO1lBQ2xGO1lBQ0EsT0FBT1g7UUFDVDtJQUNGO0lBQ0FhLE9BQU87UUFBRUMsUUFBUTtJQUFTO0lBQzFCQyxRQUFRQyxRQUFRQyxHQUFHLENBQUNDLGVBQWU7QUFDckMsRUFBRSIsInNvdXJjZXMiOlsid2VicGFjazovL3ZlemluLWFwcC8uL2xpYi9hdXRoLnRzP2JmN2UiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgTmV4dEF1dGhPcHRpb25zIH0gZnJvbSBcIm5leHQtYXV0aFwiO1xuaW1wb3J0IENyZWRlbnRpYWxzUHJvdmlkZXIgZnJvbSBcIm5leHQtYXV0aC9wcm92aWRlcnMvY3JlZGVudGlhbHNcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuL3ByaXNtYVwiO1xuaW1wb3J0IGJjcnlwdCBmcm9tIFwiYmNyeXB0anNcIjtcblxuZXhwb3J0IGNvbnN0IGF1dGhPcHRpb25zOiBOZXh0QXV0aE9wdGlvbnMgPSB7XG4gIHByb3ZpZGVyczogW1xuICAgIENyZWRlbnRpYWxzUHJvdmlkZXIoe1xuICAgICAgbmFtZTogXCJDcmVkZW50aWFsc1wiLFxuICAgICAgY3JlZGVudGlhbHM6IHtcbiAgICAgICAgZW1haWw6IHsgbGFiZWw6IFwiRS1wb3N0YVwiLCB0eXBlOiBcImVtYWlsXCIgfSxcbiAgICAgICAgcGFzc3dvcmQ6IHsgbGFiZWw6IFwixZ5pZnJlXCIsIHR5cGU6IFwicGFzc3dvcmRcIiB9LFxuICAgICAgfSxcbiAgICAgIGFzeW5jIGF1dGhvcml6ZShjcmVkZW50aWFscywgcmVxKSB7XG4gICAgICAgIGlmICghY3JlZGVudGlhbHM/LmVtYWlsIHx8ICFjcmVkZW50aWFscz8ucGFzc3dvcmQpIHJldHVybiBudWxsO1xuXG4gICAgICAgIGNvbnN0IHJhd0lwID0gcmVxPy5oZWFkZXJzPy5bXCJ4LWZvcndhcmRlZC1mb3JcIl0gPz8gcmVxPy5oZWFkZXJzPy5bXCJ4LXJlYWwtaXBcIl0gPz8gXCJ1bmtub3duXCI7XG4gICAgICAgIGNvbnN0IGlwID0gQXJyYXkuaXNBcnJheShyYXdJcCkgPyByYXdJcFswXSA6IChyYXdJcCBhcyBzdHJpbmcpLnNwbGl0KFwiLFwiKVswXS50cmltKCk7XG4gICAgICAgIGNvbnN0IHVzZXJBZ2VudCA9IChyZXE/LmhlYWRlcnM/LltcInVzZXItYWdlbnRcIl0gYXMgc3RyaW5nKSA/PyBcInVua25vd25cIjtcblxuICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgICAgICAgd2hlcmU6IHsgZW1haWw6IGNyZWRlbnRpYWxzLmVtYWlsIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmICghdXNlcikge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBwcmlzbWEubG9naW5Mb2cuY3JlYXRlKHsgZGF0YTogeyBpcCwgdXNlckFnZW50LCBzdWNjZXNzOiBmYWxzZSB9IH0pO1xuICAgICAgICAgIH0gY2F0Y2ggeyAvKiBpZ25vcmUgKi8gfVxuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUGFzaWYgdmV5YSBzaWxpbm1pxZ8gaGVzYXBsYXIgZ2lyacWfIHlhcGFtYXpcbiAgICAgICAgaWYgKHVzZXIuc3RhdHVzID09PSBcIklOQUNUSVZFXCIgfHwgdXNlci5zdGF0dXMgPT09IFwiREVMRVRFRFwiKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IHByaXNtYS5sb2dpbkxvZy5jcmVhdGUoeyBkYXRhOiB7IHVzZXJJZDogdXNlci5pZCwgaXAsIHVzZXJBZ2VudCwgc3VjY2VzczogZmFsc2UgfSB9KTtcbiAgICAgICAgICB9IGNhdGNoIHsgLyogaWdub3JlICovIH1cbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHZhbGlkID0gYXdhaXQgYmNyeXB0LmNvbXBhcmUoY3JlZGVudGlhbHMucGFzc3dvcmQsIHVzZXIucGFzc3dvcmQpO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgYXdhaXQgcHJpc21hLmxvZ2luTG9nLmNyZWF0ZSh7XG4gICAgICAgICAgICBkYXRhOiB7IHVzZXJJZDogdXNlci5pZCwgaXAsIHVzZXJBZ2VudCwgc3VjY2VzczogdmFsaWQgfSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCB7IC8qIGlnbm9yZSAqLyB9XG5cbiAgICAgICAgaWYgKCF2YWxpZCkgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBpZDogdXNlci5pZCxcbiAgICAgICAgICBuYW1lOiB1c2VyLm5hbWUsXG4gICAgICAgICAgZW1haWw6IHVzZXIuZW1haWwsXG4gICAgICAgICAgcm9sZTogdXNlci5yb2xlIGFzIFwiQURNSU5cIiB8IFwiRU1QTE9ZRUVcIixcbiAgICAgICAgICBkZXBhcnRtZW50OiB1c2VyLmRlcGFydG1lbnQsXG4gICAgICAgICAgbXVzdENoYW5nZVBhc3N3b3JkOiB1c2VyLm11c3RDaGFuZ2VQYXNzd29yZCxcbiAgICAgICAgICBjYW5WaWV3QWxsVGFza3M6IHVzZXIuY2FuVmlld0FsbFRhc2tzLFxuICAgICAgICAgIHNlbmlvcml0eUxldmVsOiB1c2VyLnNlbmlvcml0eUxldmVsLFxuICAgICAgICAgIHN0YXR1czogdXNlci5zdGF0dXMsXG4gICAgICAgIH07XG4gICAgICB9LFxuICAgIH0pLFxuICBdLFxuICBzZXNzaW9uOiB7IHN0cmF0ZWd5OiBcImp3dFwiIH0sXG4gIGNhbGxiYWNrczoge1xuICAgIGFzeW5jIGp3dCh7IHRva2VuLCB1c2VyLCB0cmlnZ2VyLCBzZXNzaW9uIH0pIHtcbiAgICAgIGlmICh1c2VyKSB7XG4gICAgICAgIHRva2VuLmlkID0gdXNlci5pZDtcbiAgICAgIH1cbiAgICAgIC8vIEhlciB0b2tlbiB5ZW5pbGVtZXNpbmRlIERCJ2RlbiBnw7xuY2VsIHJvbC9kZXBhcnRtYW4vbXVzdENoYW5nZVBhc3N3b3JkIMOnZWtcbiAgICAgIC8vIOKGkiBQYW5lbGRlbiB5YXDEsWxhbiB5ZXRraSBkZcSfacWfaWtsacSfaSBrdWxsYW7EsWPEsSBzYXlmYSB5ZW5pbGV5aW5jZSBhbsSxbmRhIHlhbnPEsXJcbiAgICAgIGlmICh0b2tlbi5pZCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IGRiVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgICAgICAgICAgd2hlcmU6IHsgaWQ6IHRva2VuLmlkIGFzIHN0cmluZyB9LFxuICAgICAgICAgICAgc2VsZWN0OiB7IHJvbGU6IHRydWUsIGRlcGFydG1lbnQ6IHRydWUsIG11c3RDaGFuZ2VQYXNzd29yZDogdHJ1ZSwgY2FuVmlld0FsbFRhc2tzOiB0cnVlLCBzZW5pb3JpdHlMZXZlbDogdHJ1ZSwgY2FuVmlld0FsbFByb2plY3RzOiB0cnVlLCBvdmVyc2Vlc0RlcGFydG1lbnQ6IHRydWUsIGNhbk1hbmFnZUNvbXBhbmllczogdHJ1ZSwgY2FuQWNjZXNzUm90YXN5b246IHRydWUsIHN0YXR1czogdHJ1ZSB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGlmIChkYlVzZXIpIHtcbiAgICAgICAgICAgIHRva2VuLnJvbGUgPSBkYlVzZXIucm9sZSBhcyBcIkFETUlOXCIgfCBcIkVNUExPWUVFXCI7XG4gICAgICAgICAgICB0b2tlbi5kZXBhcnRtZW50ID0gZGJVc2VyLmRlcGFydG1lbnQgYXMgdHlwZW9mIHRva2VuLmRlcGFydG1lbnQ7XG4gICAgICAgICAgICB0b2tlbi5tdXN0Q2hhbmdlUGFzc3dvcmQgPSBkYlVzZXIubXVzdENoYW5nZVBhc3N3b3JkID8/IGZhbHNlO1xuICAgICAgICAgICAgdG9rZW4uY2FuVmlld0FsbFRhc2tzID0gZGJVc2VyLmNhblZpZXdBbGxUYXNrcyA/PyBmYWxzZTtcbiAgICAgICAgICAgIHRva2VuLnNlbmlvcml0eUxldmVsID0gZGJVc2VyLnNlbmlvcml0eUxldmVsID8/IDA7XG4gICAgICAgICAgICB0b2tlbi5jYW5WaWV3QWxsUHJvamVjdHMgPSBkYlVzZXIuY2FuVmlld0FsbFByb2plY3RzID8/IGZhbHNlO1xuICAgICAgICAgICAgdG9rZW4ub3ZlcnNlZXNEZXBhcnRtZW50ID0gZGJVc2VyLm92ZXJzZWVzRGVwYXJ0bWVudCA/PyBudWxsO1xuICAgICAgICAgICAgdG9rZW4uY2FuTWFuYWdlQ29tcGFuaWVzID0gZGJVc2VyLmNhbk1hbmFnZUNvbXBhbmllcyA/PyBmYWxzZTtcbiAgICAgICAgICAgIHRva2VuLmNhbkFjY2Vzc1JvdGFzeW9uID0gZGJVc2VyLmNhbkFjY2Vzc1JvdGFzeW9uID8/IGZhbHNlO1xuICAgICAgICAgICAgdG9rZW4uc3RhdHVzID0gZGJVc2VyLnN0YXR1cyA/PyBcIkFDVElWRVwiO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBLdWxsYW7EsWPEsSBEQidkZW4gc2lsaW5tacWfc2Ugb3R1cnVtdSBnZcOnZXJzaXogc2F5XG4gICAgICAgICAgICB0b2tlbi5zdGF0dXMgPSBcIkRFTEVURURcIjtcbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIC8vIERCIGVyacWfaW0gaGF0YXPEsSBvbHVyc2EgbWV2Y3V0IHRva2VuIGRlxJ9lcmxlcmkga29ydW51clxuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBjbGllbnQtc2lkZSBzZXNzaW9uLnVwZGF0ZSgpIGlsZSBtdXN0Q2hhbmdlUGFzc3dvcmQgdGVtaXpsZW5lYmlsc2luXG4gICAgICBpZiAodHJpZ2dlciA9PT0gXCJ1cGRhdGVcIiAmJiBzZXNzaW9uPy5tdXN0Q2hhbmdlUGFzc3dvcmQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICB0b2tlbi5tdXN0Q2hhbmdlUGFzc3dvcmQgPSBzZXNzaW9uLm11c3RDaGFuZ2VQYXNzd29yZDtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0b2tlbjtcbiAgICB9LFxuICAgIHNlc3Npb24oeyBzZXNzaW9uLCB0b2tlbiB9KSB7XG4gICAgICBpZiAoc2Vzc2lvbi51c2VyKSB7XG4gICAgICAgIChzZXNzaW9uLnVzZXIgYXMgYW55KS5pZCA9IHRva2VuLmlkIGFzIHN0cmluZztcbiAgICAgICAgKHNlc3Npb24udXNlciBhcyBhbnkpLnJvbGUgPSB0b2tlbi5yb2xlIGFzIHN0cmluZztcbiAgICAgICAgKHNlc3Npb24udXNlciBhcyBhbnkpLmRlcGFydG1lbnQgPSB0b2tlbi5kZXBhcnRtZW50IGFzIHN0cmluZztcbiAgICAgICAgKHNlc3Npb24udXNlciBhcyBhbnkpLm11c3RDaGFuZ2VQYXNzd29yZCA9IHRva2VuLm11c3RDaGFuZ2VQYXNzd29yZCBhcyBib29sZWFuO1xuICAgICAgICAoc2Vzc2lvbi51c2VyIGFzIGFueSkuY2FuVmlld0FsbFRhc2tzID0gdG9rZW4uY2FuVmlld0FsbFRhc2tzIGFzIGJvb2xlYW4gPz8gZmFsc2U7XG4gICAgICAgIChzZXNzaW9uLnVzZXIgYXMgYW55KS5zZW5pb3JpdHlMZXZlbCA9IHRva2VuLnNlbmlvcml0eUxldmVsIGFzIG51bWJlciA/PyAwO1xuICAgICAgICAoc2Vzc2lvbi51c2VyIGFzIGFueSkuY2FuVmlld0FsbFByb2plY3RzID0gdG9rZW4uY2FuVmlld0FsbFByb2plY3RzIGFzIGJvb2xlYW4gPz8gZmFsc2U7XG4gICAgICAgIChzZXNzaW9uLnVzZXIgYXMgYW55KS5vdmVyc2Vlc0RlcGFydG1lbnQgPSB0b2tlbi5vdmVyc2Vlc0RlcGFydG1lbnQgYXMgc3RyaW5nIHwgbnVsbCA/PyBudWxsO1xuICAgICAgICAoc2Vzc2lvbi51c2VyIGFzIGFueSkuY2FuTWFuYWdlQ29tcGFuaWVzID0gdG9rZW4uY2FuTWFuYWdlQ29tcGFuaWVzIGFzIGJvb2xlYW4gPz8gZmFsc2U7XG4gICAgICAgIChzZXNzaW9uLnVzZXIgYXMgYW55KS5jYW5BY2Nlc3NSb3Rhc3lvbiA9IHRva2VuLmNhbkFjY2Vzc1JvdGFzeW9uIGFzIGJvb2xlYW4gPz8gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2Vzc2lvbjtcbiAgICB9LFxuICB9LFxuICBwYWdlczogeyBzaWduSW46IFwiL2xvZ2luXCIgfSxcbiAgc2VjcmV0OiBwcm9jZXNzLmVudi5ORVhUQVVUSF9TRUNSRVQsXG59O1xuIl0sIm5hbWVzIjpbIkNyZWRlbnRpYWxzUHJvdmlkZXIiLCJwcmlzbWEiLCJiY3J5cHQiLCJhdXRoT3B0aW9ucyIsInByb3ZpZGVycyIsIm5hbWUiLCJjcmVkZW50aWFscyIsImVtYWlsIiwibGFiZWwiLCJ0eXBlIiwicGFzc3dvcmQiLCJhdXRob3JpemUiLCJyZXEiLCJyYXdJcCIsImhlYWRlcnMiLCJpcCIsIkFycmF5IiwiaXNBcnJheSIsInNwbGl0IiwidHJpbSIsInVzZXJBZ2VudCIsInVzZXIiLCJmaW5kVW5pcXVlIiwid2hlcmUiLCJsb2dpbkxvZyIsImNyZWF0ZSIsImRhdGEiLCJzdWNjZXNzIiwic3RhdHVzIiwidXNlcklkIiwiaWQiLCJ2YWxpZCIsImNvbXBhcmUiLCJyb2xlIiwiZGVwYXJ0bWVudCIsIm11c3RDaGFuZ2VQYXNzd29yZCIsImNhblZpZXdBbGxUYXNrcyIsInNlbmlvcml0eUxldmVsIiwic2Vzc2lvbiIsInN0cmF0ZWd5IiwiY2FsbGJhY2tzIiwiand0IiwidG9rZW4iLCJ0cmlnZ2VyIiwiZGJVc2VyIiwic2VsZWN0IiwiY2FuVmlld0FsbFByb2plY3RzIiwib3ZlcnNlZXNEZXBhcnRtZW50IiwiY2FuTWFuYWdlQ29tcGFuaWVzIiwiY2FuQWNjZXNzUm90YXN5b24iLCJ1bmRlZmluZWQiLCJwYWdlcyIsInNpZ25JbiIsInNlY3JldCIsInByb2Nlc3MiLCJlbnYiLCJORVhUQVVUSF9TRUNSRVQiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./lib/auth.ts\n");

/***/ }),

/***/ "(rsc)/./lib/prisma.ts":
/*!***********************!*\
  !*** ./lib/prisma.ts ***!
  \***********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   prisma: () => (/* binding */ prisma)\n/* harmony export */ });\n/* harmony import */ var _prisma_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @prisma/client */ \"@prisma/client\");\n/* harmony import */ var _prisma_client__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_prisma_client__WEBPACK_IMPORTED_MODULE_0__);\n\nconst globalForPrisma = globalThis;\nconst prisma = globalForPrisma.prisma ?? new _prisma_client__WEBPACK_IMPORTED_MODULE_0__.PrismaClient({\n    log:  true ? [\n        \"error\"\n    ] : 0\n});\nif (true) globalForPrisma.prisma = prisma;\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9saWIvcHJpc21hLnRzIiwibWFwcGluZ3MiOiI7Ozs7OztBQUE4QztBQUU5QyxNQUFNQyxrQkFBa0JDO0FBRWpCLE1BQU1DLFNBQ1hGLGdCQUFnQkUsTUFBTSxJQUN0QixJQUFJSCx3REFBWUEsQ0FBQztJQUFFSSxLQUFLQyxLQUFzQyxHQUFHO1FBQUM7S0FBUSxHQUFHLENBQUU7QUFBQyxHQUFHO0FBRXJGLElBQUlBLElBQXFDLEVBQUVKLGdCQUFnQkUsTUFBTSxHQUFHQSIsInNvdXJjZXMiOlsid2VicGFjazovL3ZlemluLWFwcC8uL2xpYi9wcmlzbWEudHM/OTgyMiJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBQcmlzbWFDbGllbnQgfSBmcm9tIFwiQHByaXNtYS9jbGllbnRcIjtcblxuY29uc3QgZ2xvYmFsRm9yUHJpc21hID0gZ2xvYmFsVGhpcyBhcyB1bmtub3duIGFzIHsgcHJpc21hOiBQcmlzbWFDbGllbnQgfTtcblxuZXhwb3J0IGNvbnN0IHByaXNtYSA9XG4gIGdsb2JhbEZvclByaXNtYS5wcmlzbWEgPz9cbiAgbmV3IFByaXNtYUNsaWVudCh7IGxvZzogcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09IFwiZGV2ZWxvcG1lbnRcIiA/IFtcImVycm9yXCJdIDogW10gfSk7XG5cbmlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gXCJwcm9kdWN0aW9uXCIpIGdsb2JhbEZvclByaXNtYS5wcmlzbWEgPSBwcmlzbWE7XG4iXSwibmFtZXMiOlsiUHJpc21hQ2xpZW50IiwiZ2xvYmFsRm9yUHJpc21hIiwiZ2xvYmFsVGhpcyIsInByaXNtYSIsImxvZyIsInByb2Nlc3MiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./lib/prisma.ts\n");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next","vendor-chunks/next-auth","vendor-chunks/@babel","vendor-chunks/jose","vendor-chunks/openid-client","vendor-chunks/uuid","vendor-chunks/oauth","vendor-chunks/@panva","vendor-chunks/yallist","vendor-chunks/preact-render-to-string","vendor-chunks/bcryptjs","vendor-chunks/preact","vendor-chunks/oidc-token-hash","vendor-chunks/object-hash","vendor-chunks/lru-cache","vendor-chunks/cookie"], () => (__webpack_exec__("(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute&page=%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute.ts&appDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!")));
module.exports = __webpack_exports__;

})();