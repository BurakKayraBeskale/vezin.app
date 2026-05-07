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
exports.id = "app/api/dashboard/route";
exports.ids = ["app/api/dashboard/route"];
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

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fdashboard%2Froute&page=%2Fapi%2Fdashboard%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fdashboard%2Froute.ts&appDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!":
/*!***************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fdashboard%2Froute&page=%2Fapi%2Fdashboard%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fdashboard%2Froute.ts&appDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D! ***!
  \***************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   originalPathname: () => (/* binding */ originalPathname),\n/* harmony export */   patchFetch: () => (/* binding */ patchFetch),\n/* harmony export */   requestAsyncStorage: () => (/* binding */ requestAsyncStorage),\n/* harmony export */   routeModule: () => (/* binding */ routeModule),\n/* harmony export */   serverHooks: () => (/* binding */ serverHooks),\n/* harmony export */   staticGenerationAsyncStorage: () => (/* binding */ staticGenerationAsyncStorage)\n/* harmony export */ });\n/* harmony import */ var next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/server/future/route-modules/app-route/module.compiled */ \"(rsc)/./node_modules/next/dist/server/future/route-modules/app-route/module.compiled.js\");\n/* harmony import */ var next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/future/route-kind */ \"(rsc)/./node_modules/next/dist/server/future/route-kind.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/server/lib/patch-fetch */ \"(rsc)/./node_modules/next/dist/server/lib/patch-fetch.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var C_Users_Kullan_c_vezin_app_app_api_dashboard_route_ts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./app/api/dashboard/route.ts */ \"(rsc)/./app/api/dashboard/route.ts\");\n\n\n\n\n// We inject the nextConfigOutput here so that we can use them in the route\n// module.\nconst nextConfigOutput = \"\"\nconst routeModule = new next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__.AppRouteRouteModule({\n    definition: {\n        kind: next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind.APP_ROUTE,\n        page: \"/api/dashboard/route\",\n        pathname: \"/api/dashboard\",\n        filename: \"route\",\n        bundlePath: \"app/api/dashboard/route\"\n    },\n    resolvedPagePath: \"C:\\\\Users\\\\Kullanıcı\\\\vezin-app\\\\app\\\\api\\\\dashboard\\\\route.ts\",\n    nextConfigOutput,\n    userland: C_Users_Kullan_c_vezin_app_app_api_dashboard_route_ts__WEBPACK_IMPORTED_MODULE_3__\n});\n// Pull out the exports that we need to expose from the module. This should\n// be eliminated when we've moved the other routes to the new format. These\n// are used to hook into the route.\nconst { requestAsyncStorage, staticGenerationAsyncStorage, serverHooks } = routeModule;\nconst originalPathname = \"/api/dashboard/route\";\nfunction patchFetch() {\n    return (0,next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__.patchFetch)({\n        serverHooks,\n        staticGenerationAsyncStorage\n    });\n}\n\n\n//# sourceMappingURL=app-route.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvbmV4dC9kaXN0L2J1aWxkL3dlYnBhY2svbG9hZGVycy9uZXh0LWFwcC1sb2FkZXIuanM/bmFtZT1hcHAlMkZhcGklMkZkYXNoYm9hcmQlMkZyb3V0ZSZwYWdlPSUyRmFwaSUyRmRhc2hib2FyZCUyRnJvdXRlJmFwcFBhdGhzPSZwYWdlUGF0aD1wcml2YXRlLW5leHQtYXBwLWRpciUyRmFwaSUyRmRhc2hib2FyZCUyRnJvdXRlLnRzJmFwcERpcj1DJTNBJTVDVXNlcnMlNUNLdWxsYW4lQzQlQjFjJUM0JUIxJTVDdmV6aW4tYXBwJTVDYXBwJnBhZ2VFeHRlbnNpb25zPXRzeCZwYWdlRXh0ZW5zaW9ucz10cyZwYWdlRXh0ZW5zaW9ucz1qc3gmcGFnZUV4dGVuc2lvbnM9anMmcm9vdERpcj1DJTNBJTVDVXNlcnMlNUNLdWxsYW4lQzQlQjFjJUM0JUIxJTVDdmV6aW4tYXBwJmlzRGV2PXRydWUmdHNjb25maWdQYXRoPXRzY29uZmlnLmpzb24mYmFzZVBhdGg9JmFzc2V0UHJlZml4PSZuZXh0Q29uZmlnT3V0cHV0PSZwcmVmZXJyZWRSZWdpb249Jm1pZGRsZXdhcmVDb25maWc9ZTMwJTNEISIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUFBc0c7QUFDdkM7QUFDYztBQUNjO0FBQzNGO0FBQ0E7QUFDQTtBQUNBLHdCQUF3QixnSEFBbUI7QUFDM0M7QUFDQSxjQUFjLHlFQUFTO0FBQ3ZCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQSxZQUFZO0FBQ1osQ0FBQztBQUNEO0FBQ0E7QUFDQTtBQUNBLFFBQVEsaUVBQWlFO0FBQ3pFO0FBQ0E7QUFDQSxXQUFXLDRFQUFXO0FBQ3RCO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDdUg7O0FBRXZIIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vdmV6aW4tYXBwLz83Y2RkIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFwcFJvdXRlUm91dGVNb2R1bGUgfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9mdXR1cmUvcm91dGUtbW9kdWxlcy9hcHAtcm91dGUvbW9kdWxlLmNvbXBpbGVkXCI7XG5pbXBvcnQgeyBSb3V0ZUtpbmQgfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9mdXR1cmUvcm91dGUta2luZFwiO1xuaW1wb3J0IHsgcGF0Y2hGZXRjaCBhcyBfcGF0Y2hGZXRjaCB9IGZyb20gXCJuZXh0L2Rpc3Qvc2VydmVyL2xpYi9wYXRjaC1mZXRjaFwiO1xuaW1wb3J0ICogYXMgdXNlcmxhbmQgZnJvbSBcIkM6XFxcXFVzZXJzXFxcXEt1bGxhbsSxY8SxXFxcXHZlemluLWFwcFxcXFxhcHBcXFxcYXBpXFxcXGRhc2hib2FyZFxcXFxyb3V0ZS50c1wiO1xuLy8gV2UgaW5qZWN0IHRoZSBuZXh0Q29uZmlnT3V0cHV0IGhlcmUgc28gdGhhdCB3ZSBjYW4gdXNlIHRoZW0gaW4gdGhlIHJvdXRlXG4vLyBtb2R1bGUuXG5jb25zdCBuZXh0Q29uZmlnT3V0cHV0ID0gXCJcIlxuY29uc3Qgcm91dGVNb2R1bGUgPSBuZXcgQXBwUm91dGVSb3V0ZU1vZHVsZSh7XG4gICAgZGVmaW5pdGlvbjoge1xuICAgICAgICBraW5kOiBSb3V0ZUtpbmQuQVBQX1JPVVRFLFxuICAgICAgICBwYWdlOiBcIi9hcGkvZGFzaGJvYXJkL3JvdXRlXCIsXG4gICAgICAgIHBhdGhuYW1lOiBcIi9hcGkvZGFzaGJvYXJkXCIsXG4gICAgICAgIGZpbGVuYW1lOiBcInJvdXRlXCIsXG4gICAgICAgIGJ1bmRsZVBhdGg6IFwiYXBwL2FwaS9kYXNoYm9hcmQvcm91dGVcIlxuICAgIH0sXG4gICAgcmVzb2x2ZWRQYWdlUGF0aDogXCJDOlxcXFxVc2Vyc1xcXFxLdWxsYW7EsWPEsVxcXFx2ZXppbi1hcHBcXFxcYXBwXFxcXGFwaVxcXFxkYXNoYm9hcmRcXFxccm91dGUudHNcIixcbiAgICBuZXh0Q29uZmlnT3V0cHV0LFxuICAgIHVzZXJsYW5kXG59KTtcbi8vIFB1bGwgb3V0IHRoZSBleHBvcnRzIHRoYXQgd2UgbmVlZCB0byBleHBvc2UgZnJvbSB0aGUgbW9kdWxlLiBUaGlzIHNob3VsZFxuLy8gYmUgZWxpbWluYXRlZCB3aGVuIHdlJ3ZlIG1vdmVkIHRoZSBvdGhlciByb3V0ZXMgdG8gdGhlIG5ldyBmb3JtYXQuIFRoZXNlXG4vLyBhcmUgdXNlZCB0byBob29rIGludG8gdGhlIHJvdXRlLlxuY29uc3QgeyByZXF1ZXN0QXN5bmNTdG9yYWdlLCBzdGF0aWNHZW5lcmF0aW9uQXN5bmNTdG9yYWdlLCBzZXJ2ZXJIb29rcyB9ID0gcm91dGVNb2R1bGU7XG5jb25zdCBvcmlnaW5hbFBhdGhuYW1lID0gXCIvYXBpL2Rhc2hib2FyZC9yb3V0ZVwiO1xuZnVuY3Rpb24gcGF0Y2hGZXRjaCgpIHtcbiAgICByZXR1cm4gX3BhdGNoRmV0Y2goe1xuICAgICAgICBzZXJ2ZXJIb29rcyxcbiAgICAgICAgc3RhdGljR2VuZXJhdGlvbkFzeW5jU3RvcmFnZVxuICAgIH0pO1xufVxuZXhwb3J0IHsgcm91dGVNb2R1bGUsIHJlcXVlc3RBc3luY1N0b3JhZ2UsIHN0YXRpY0dlbmVyYXRpb25Bc3luY1N0b3JhZ2UsIHNlcnZlckhvb2tzLCBvcmlnaW5hbFBhdGhuYW1lLCBwYXRjaEZldGNoLCAgfTtcblxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YXBwLXJvdXRlLmpzLm1hcCJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fdashboard%2Froute&page=%2Fapi%2Fdashboard%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fdashboard%2Froute.ts&appDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!\n");

/***/ }),

/***/ "(rsc)/./app/api/dashboard/route.ts":
/*!************************************!*\
  !*** ./app/api/dashboard/route.ts ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   GET: () => (/* binding */ GET)\n/* harmony export */ });\n/* harmony import */ var next_server__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/server */ \"(rsc)/./node_modules/next/dist/api/server.js\");\n/* harmony import */ var next_auth__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next-auth */ \"(rsc)/./node_modules/next-auth/index.js\");\n/* harmony import */ var next_auth__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(next_auth__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var _lib_auth__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @/lib/auth */ \"(rsc)/./lib/auth.ts\");\n/* harmony import */ var _lib_prisma__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @/lib/prisma */ \"(rsc)/./lib/prisma.ts\");\n\n\n\n\nfunction weekBounds(weeksAgo) {\n    const now = new Date();\n    const day = now.getDay(); // 0=Sun,1=Mon,...\n    const diffToMonday = day === 0 ? -6 : 1 - day;\n    const monday = new Date(now);\n    monday.setDate(now.getDate() + diffToMonday - weeksAgo * 7);\n    monday.setHours(0, 0, 0, 0);\n    const sunday = new Date(monday);\n    sunday.setDate(monday.getDate() + 7);\n    return {\n        start: monday,\n        end: sunday\n    };\n}\nasync function GET() {\n    const session = await (0,next_auth__WEBPACK_IMPORTED_MODULE_1__.getServerSession)(_lib_auth__WEBPACK_IMPORTED_MODULE_2__.authOptions);\n    if (!session) return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n        error: \"Yetkisiz\"\n    }, {\n        status: 401\n    });\n    const now = new Date();\n    const thisWeekStart = weekBounds(0).start;\n    const { start: lastStart, end: lastEnd } = weekBounds(1);\n    const [openTasks, completedThisWeek, overdueTasks, activeUsers, completedLastWeek, overdueLastWeek, tasksByStatus] = await Promise.all([\n        _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.task.count({\n            where: {\n                status: {\n                    not: \"DONE\"\n                }\n            }\n        }),\n        _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.task.count({\n            where: {\n                status: \"DONE\",\n                updatedAt: {\n                    gte: thisWeekStart\n                }\n            }\n        }),\n        _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.task.count({\n            where: {\n                dueDate: {\n                    lt: now\n                },\n                status: {\n                    not: \"DONE\"\n                }\n            }\n        }),\n        _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.user.count({\n            where: {\n                assignedTasks: {\n                    some: {\n                        status: {\n                            in: [\n                                \"IN_PROGRESS\",\n                                \"REVIEW\"\n                            ]\n                        }\n                    }\n                }\n            }\n        }),\n        _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.task.count({\n            where: {\n                status: \"DONE\",\n                updatedAt: {\n                    gte: lastStart,\n                    lt: lastEnd\n                }\n            }\n        }),\n        _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.task.count({\n            where: {\n                dueDate: {\n                    lt: lastEnd\n                },\n                status: {\n                    not: \"DONE\"\n                },\n                createdAt: {\n                    lt: lastEnd\n                }\n            }\n        }),\n        _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.task.groupBy({\n            by: [\n                \"status\"\n            ],\n            _count: {\n                id: true\n            }\n        })\n    ]);\n    const statusMap = Object.fromEntries(tasksByStatus.map((s)=>[\n            s.status,\n            s._count.id\n        ]));\n    // Last 7 weeks performance\n    const weeklyData = await Promise.all(Array.from({\n        length: 7\n    }, async (_, i)=>{\n        const weeksAgo = 6 - i; // oldest first\n        const { start, end } = weekBounds(weeksAgo);\n        const [acilan, kapanan, geciken] = await Promise.all([\n            _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.task.count({\n                where: {\n                    createdAt: {\n                        gte: start,\n                        lt: end\n                    }\n                }\n            }),\n            _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.task.count({\n                where: {\n                    status: \"DONE\",\n                    updatedAt: {\n                        gte: start,\n                        lt: end\n                    }\n                }\n            }),\n            _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.task.count({\n                where: {\n                    dueDate: {\n                        gte: start,\n                        lt: end\n                    },\n                    status: {\n                        not: \"DONE\"\n                    }\n                }\n            })\n        ]);\n        const label = weeksAgo === 0 ? \"Bu Hafta\" : `H-${weeksAgo}`;\n        return {\n            week: label,\n            acilan,\n            kapanan,\n            geciken\n        };\n    }));\n    return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n        openTasks,\n        completedThisWeek,\n        overdueTasks,\n        activeUsers,\n        completedLastWeek,\n        overdueLastWeek,\n        tasksByStatus: {\n            todo: statusMap[\"TODO\"] ?? 0,\n            inProgress: statusMap[\"IN_PROGRESS\"] ?? 0,\n            review: statusMap[\"REVIEW\"] ?? 0,\n            done: statusMap[\"DONE\"] ?? 0\n        },\n        weeklyData\n    });\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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QVlqQixTQUFTLENBQUMsY0FBYyxJQUFJO1lBQ3hDa0IsUUFBUWxCLFNBQVMsQ0FBQyxTQUFTLElBQUk7WUFDL0JtQixNQUFNbkIsU0FBUyxDQUFDLE9BQU8sSUFBSTtRQUM3QjtRQUNBSztJQUNGO0FBQ0YiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly92ZXppbi1hcHAvLi9hcHAvYXBpL2Rhc2hib2FyZC9yb3V0ZS50cz9lYjQ1Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IE5leHRSZXNwb25zZSB9IGZyb20gXCJuZXh0L3NlcnZlclwiO1xuaW1wb3J0IHsgZ2V0U2VydmVyU2Vzc2lvbiB9IGZyb20gXCJuZXh0LWF1dGhcIjtcbmltcG9ydCB7IGF1dGhPcHRpb25zIH0gZnJvbSBcIkAvbGliL2F1dGhcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCJAL2xpYi9wcmlzbWFcIjtcblxuZnVuY3Rpb24gd2Vla0JvdW5kcyh3ZWVrc0FnbzogbnVtYmVyKSB7XG4gIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XG4gIGNvbnN0IGRheSA9IG5vdy5nZXREYXkoKTsgLy8gMD1TdW4sMT1Nb24sLi4uXG4gIGNvbnN0IGRpZmZUb01vbmRheSA9IChkYXkgPT09IDAgPyAtNiA6IDEgLSBkYXkpO1xuICBjb25zdCBtb25kYXkgPSBuZXcgRGF0ZShub3cpO1xuICBtb25kYXkuc2V0RGF0ZShub3cuZ2V0RGF0ZSgpICsgZGlmZlRvTW9uZGF5IC0gd2Vla3NBZ28gKiA3KTtcbiAgbW9uZGF5LnNldEhvdXJzKDAsIDAsIDAsIDApO1xuICBjb25zdCBzdW5kYXkgPSBuZXcgRGF0ZShtb25kYXkpO1xuICBzdW5kYXkuc2V0RGF0ZShtb25kYXkuZ2V0RGF0ZSgpICsgNyk7XG4gIHJldHVybiB7IHN0YXJ0OiBtb25kYXksIGVuZDogc3VuZGF5IH07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBHRVQoKSB7XG4gIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBnZXRTZXJ2ZXJTZXNzaW9uKGF1dGhPcHRpb25zKTtcbiAgaWYgKCFzZXNzaW9uKSByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oeyBlcnJvcjogXCJZZXRraXNpelwiIH0sIHsgc3RhdHVzOiA0MDEgfSk7XG5cbiAgY29uc3Qgbm93ID0gbmV3IERhdGUoKTtcbiAgY29uc3QgdGhpc1dlZWtTdGFydCA9IHdlZWtCb3VuZHMoMCkuc3RhcnQ7XG4gIGNvbnN0IHsgc3RhcnQ6IGxhc3RTdGFydCwgZW5kOiBsYXN0RW5kIH0gPSB3ZWVrQm91bmRzKDEpO1xuXG4gIGNvbnN0IFtcbiAgICBvcGVuVGFza3MsXG4gICAgY29tcGxldGVkVGhpc1dlZWssXG4gICAgb3ZlcmR1ZVRhc2tzLFxuICAgIGFjdGl2ZVVzZXJzLFxuICAgIGNvbXBsZXRlZExhc3RXZWVrLFxuICAgIG92ZXJkdWVMYXN0V2VlayxcbiAgICB0YXNrc0J5U3RhdHVzLFxuICBdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS50YXNrLmNvdW50KHsgd2hlcmU6IHsgc3RhdHVzOiB7IG5vdDogXCJET05FXCIgfSB9IH0pLFxuICAgIHByaXNtYS50YXNrLmNvdW50KHtcbiAgICAgIHdoZXJlOiB7IHN0YXR1czogXCJET05FXCIsIHVwZGF0ZWRBdDogeyBndGU6IHRoaXNXZWVrU3RhcnQgfSB9LFxuICAgIH0pLFxuICAgIHByaXNtYS50YXNrLmNvdW50KHtcbiAgICAgIHdoZXJlOiB7IGR1ZURhdGU6IHsgbHQ6IG5vdyB9LCBzdGF0dXM6IHsgbm90OiBcIkRPTkVcIiB9IH0sXG4gICAgfSksXG4gICAgcHJpc21hLnVzZXIuY291bnQoe1xuICAgICAgd2hlcmU6IHtcbiAgICAgICAgYXNzaWduZWRUYXNrczogeyBzb21lOiB7IHN0YXR1czogeyBpbjogW1wiSU5fUFJPR1JFU1NcIiwgXCJSRVZJRVdcIl0gfSB9IH0sXG4gICAgICB9LFxuICAgIH0pLFxuICAgIHByaXNtYS50YXNrLmNvdW50KHtcbiAgICAgIHdoZXJlOiB7IHN0YXR1czogXCJET05FXCIsIHVwZGF0ZWRBdDogeyBndGU6IGxhc3RTdGFydCwgbHQ6IGxhc3RFbmQgfSB9LFxuICAgIH0pLFxuICAgIHByaXNtYS50YXNrLmNvdW50KHtcbiAgICAgIHdoZXJlOiB7IGR1ZURhdGU6IHsgbHQ6IGxhc3RFbmQgfSwgc3RhdHVzOiB7IG5vdDogXCJET05FXCIgfSwgY3JlYXRlZEF0OiB7IGx0OiBsYXN0RW5kIH0gfSxcbiAgICB9KSxcbiAgICBwcmlzbWEudGFzay5ncm91cEJ5KHtcbiAgICAgIGJ5OiBbXCJzdGF0dXNcIl0sXG4gICAgICBfY291bnQ6IHsgaWQ6IHRydWUgfSxcbiAgICB9KSxcbiAgXSk7XG5cbiAgY29uc3Qgc3RhdHVzTWFwID0gT2JqZWN0LmZyb21FbnRyaWVzKFxuICAgIHRhc2tzQnlTdGF0dXMubWFwKChzKSA9PiBbcy5zdGF0dXMsIHMuX2NvdW50LmlkXSlcbiAgKTtcblxuICAvLyBMYXN0IDcgd2Vla3MgcGVyZm9ybWFuY2VcbiAgY29uc3Qgd2Vla2x5RGF0YSA9IGF3YWl0IFByb21pc2UuYWxsKFxuICAgIEFycmF5LmZyb20oeyBsZW5ndGg6IDcgfSwgYXN5bmMgKF8sIGkpID0+IHtcbiAgICAgIGNvbnN0IHdlZWtzQWdvID0gNiAtIGk7IC8vIG9sZGVzdCBmaXJzdFxuICAgICAgY29uc3QgeyBzdGFydCwgZW5kIH0gPSB3ZWVrQm91bmRzKHdlZWtzQWdvKTtcblxuICAgICAgY29uc3QgW2FjaWxhbiwga2FwYW5hbiwgZ2VjaWtlbl0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgIHByaXNtYS50YXNrLmNvdW50KHsgd2hlcmU6IHsgY3JlYXRlZEF0OiB7IGd0ZTogc3RhcnQsIGx0OiBlbmQgfSB9IH0pLFxuICAgICAgICBwcmlzbWEudGFzay5jb3VudCh7IHdoZXJlOiB7IHN0YXR1czogXCJET05FXCIsIHVwZGF0ZWRBdDogeyBndGU6IHN0YXJ0LCBsdDogZW5kIH0gfSB9KSxcbiAgICAgICAgcHJpc21hLnRhc2suY291bnQoe1xuICAgICAgICAgIHdoZXJlOiB7IGR1ZURhdGU6IHsgZ3RlOiBzdGFydCwgbHQ6IGVuZCB9LCBzdGF0dXM6IHsgbm90OiBcIkRPTkVcIiB9IH0sXG4gICAgICAgIH0pLFxuICAgICAgXSk7XG5cbiAgICAgIGNvbnN0IGxhYmVsID0gd2Vla3NBZ28gPT09IDAgPyBcIkJ1IEhhZnRhXCIgOiBgSC0ke3dlZWtzQWdvfWA7XG4gICAgICByZXR1cm4geyB3ZWVrOiBsYWJlbCwgYWNpbGFuLCBrYXBhbmFuLCBnZWNpa2VuIH07XG4gICAgfSlcbiAgKTtcblxuICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oe1xuICAgIG9wZW5UYXNrcyxcbiAgICBjb21wbGV0ZWRUaGlzV2VlayxcbiAgICBvdmVyZHVlVGFza3MsXG4gICAgYWN0aXZlVXNlcnMsXG4gICAgY29tcGxldGVkTGFzdFdlZWssXG4gICAgb3ZlcmR1ZUxhc3RXZWVrLFxuICAgIHRhc2tzQnlTdGF0dXM6IHtcbiAgICAgIHRvZG86IHN0YXR1c01hcFtcIlRPRE9cIl0gPz8gMCxcbiAgICAgIGluUHJvZ3Jlc3M6IHN0YXR1c01hcFtcIklOX1BST0dSRVNTXCJdID8/IDAsXG4gICAgICByZXZpZXc6IHN0YXR1c01hcFtcIlJFVklFV1wiXSA/PyAwLFxuICAgICAgZG9uZTogc3RhdHVzTWFwW1wiRE9ORVwiXSA/PyAwLFxuICAgIH0sXG4gICAgd2Vla2x5RGF0YSxcbiAgfSk7XG59XG4iXSwibmFtZXMiOlsiTmV4dFJlc3BvbnNlIiwiZ2V0U2VydmVyU2Vzc2lvbiIsImF1dGhPcHRpb25zIiwicHJpc21hIiwid2Vla0JvdW5kcyIsIndlZWtzQWdvIiwibm93IiwiRGF0ZSIsImRheSIsImdldERheSIsImRpZmZUb01vbmRheSIsIm1vbmRheSIsInNldERhdGUiLCJnZXREYXRlIiwic2V0SG91cnMiLCJzdW5kYXkiLCJzdGFydCIsImVuZCIsIkdFVCIsInNlc3Npb24iLCJqc29uIiwiZXJyb3IiLCJzdGF0dXMiLCJ0aGlzV2Vla1N0YXJ0IiwibGFzdFN0YXJ0IiwibGFzdEVuZCIsIm9wZW5UYXNrcyIsImNvbXBsZXRlZFRoaXNXZWVrIiwib3ZlcmR1ZVRhc2tzIiwiYWN0aXZlVXNlcnMiLCJjb21wbGV0ZWRMYXN0V2VlayIsIm92ZXJkdWVMYXN0V2VlayIsInRhc2tzQnlTdGF0dXMiLCJQcm9taXNlIiwiYWxsIiwidGFzayIsImNvdW50Iiwid2hlcmUiLCJub3QiLCJ1cGRhdGVkQXQiLCJndGUiLCJkdWVEYXRlIiwibHQiLCJ1c2VyIiwiYXNzaWduZWRUYXNrcyIsInNvbWUiLCJpbiIsImNyZWF0ZWRBdCIsImdyb3VwQnkiLCJieSIsIl9jb3VudCIsImlkIiwic3RhdHVzTWFwIiwiT2JqZWN0IiwiZnJvbUVudHJpZXMiLCJtYXAiLCJzIiwid2Vla2x5RGF0YSIsIkFycmF5IiwiZnJvbSIsImxlbmd0aCIsIl8iLCJpIiwiYWNpbGFuIiwia2FwYW5hbiIsImdlY2lrZW4iLCJsYWJlbCIsIndlZWsiLCJ0b2RvIiwiaW5Qcm9ncmVzcyIsInJldmlldyIsImRvbmUiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./app/api/dashboard/route.ts\n");

/***/ }),

/***/ "(rsc)/./lib/auth.ts":
/*!*********************!*\
  !*** ./lib/auth.ts ***!
  \*********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   authOptions: () => (/* binding */ authOptions)\n/* harmony export */ });\n/* harmony import */ var next_auth_providers_credentials__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next-auth/providers/credentials */ \"(rsc)/./node_modules/next-auth/providers/credentials.js\");\n/* harmony import */ var _prisma__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./prisma */ \"(rsc)/./lib/prisma.ts\");\n/* harmony import */ var bcryptjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! bcryptjs */ \"(rsc)/./node_modules/bcryptjs/index.js\");\n/* harmony import */ var bcryptjs__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(bcryptjs__WEBPACK_IMPORTED_MODULE_2__);\n\n\n\nconst authOptions = {\n    providers: [\n        (0,next_auth_providers_credentials__WEBPACK_IMPORTED_MODULE_0__[\"default\"])({\n            name: \"Credentials\",\n            credentials: {\n                email: {\n                    label: \"E-posta\",\n                    type: \"email\"\n                },\n                password: {\n                    label: \"Şifre\",\n                    type: \"password\"\n                }\n            },\n            async authorize (credentials) {\n                if (!credentials?.email || !credentials?.password) return null;\n                const user = await _prisma__WEBPACK_IMPORTED_MODULE_1__.prisma.user.findUnique({\n                    where: {\n                        email: credentials.email\n                    }\n                });\n                if (!user) return null;\n                const valid = await bcryptjs__WEBPACK_IMPORTED_MODULE_2___default().compare(credentials.password, user.password);\n                if (!valid) return null;\n                return {\n                    id: user.id,\n                    name: user.name,\n                    email: user.email,\n                    role: user.role,\n                    department: user.department\n                };\n            }\n        })\n    ],\n    session: {\n        strategy: \"jwt\"\n    },\n    callbacks: {\n        jwt ({ token, user }) {\n            if (user) {\n                token.id = user.id;\n                token.role = user.role;\n                token.department = user.department;\n            }\n            return token;\n        },\n        session ({ session, token }) {\n            if (session.user) {\n                session.user.id = token.id;\n                session.user.role = token.role;\n                session.user.department = token.department;\n            }\n            return session;\n        }\n    },\n    pages: {\n        signIn: \"/login\"\n    },\n    secret: process.env.NEXTAUTH_SECRET\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9saWIvYXV0aC50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUNrRTtBQUNoQztBQUNKO0FBRXZCLE1BQU1HLGNBQStCO0lBQzFDQyxXQUFXO1FBQ1RKLDJFQUFtQkEsQ0FBQztZQUNsQkssTUFBTTtZQUNOQyxhQUFhO2dCQUNYQyxPQUFPO29CQUFFQyxPQUFPO29CQUFXQyxNQUFNO2dCQUFRO2dCQUN6Q0MsVUFBVTtvQkFBRUYsT0FBTztvQkFBU0MsTUFBTTtnQkFBVztZQUMvQztZQUNBLE1BQU1FLFdBQVVMLFdBQVc7Z0JBQ3pCLElBQUksQ0FBQ0EsYUFBYUMsU0FBUyxDQUFDRCxhQUFhSSxVQUFVLE9BQU87Z0JBRTFELE1BQU1FLE9BQU8sTUFBTVgsMkNBQU1BLENBQUNXLElBQUksQ0FBQ0MsVUFBVSxDQUFDO29CQUN4Q0MsT0FBTzt3QkFBRVAsT0FBT0QsWUFBWUMsS0FBSztvQkFBQztnQkFDcEM7Z0JBQ0EsSUFBSSxDQUFDSyxNQUFNLE9BQU87Z0JBRWxCLE1BQU1HLFFBQVEsTUFBTWIsdURBQWMsQ0FBQ0ksWUFBWUksUUFBUSxFQUFFRSxLQUFLRixRQUFRO2dCQUN0RSxJQUFJLENBQUNLLE9BQU8sT0FBTztnQkFFbkIsT0FBTztvQkFDTEUsSUFBSUwsS0FBS0ssRUFBRTtvQkFDWFosTUFBTU8sS0FBS1AsSUFBSTtvQkFDZkUsT0FBT0ssS0FBS0wsS0FBSztvQkFDakJXLE1BQU1OLEtBQUtNLElBQUk7b0JBQ2ZDLFlBQVlQLEtBQUtPLFVBQVU7Z0JBQzdCO1lBQ0Y7UUFDRjtLQUNEO0lBQ0RDLFNBQVM7UUFBRUMsVUFBVTtJQUFNO0lBQzNCQyxXQUFXO1FBQ1RDLEtBQUksRUFBRUMsS0FBSyxFQUFFWixJQUFJLEVBQUU7WUFDakIsSUFBSUEsTUFBTTtnQkFDUlksTUFBTVAsRUFBRSxHQUFHTCxLQUFLSyxFQUFFO2dCQUNsQk8sTUFBTU4sSUFBSSxHQUFHLEtBQWNBLElBQUk7Z0JBQy9CTSxNQUFNTCxVQUFVLEdBQUcsS0FBY0EsVUFBVTtZQUM3QztZQUNBLE9BQU9LO1FBQ1Q7UUFDQUosU0FBUSxFQUFFQSxPQUFPLEVBQUVJLEtBQUssRUFBRTtZQUN4QixJQUFJSixRQUFRUixJQUFJLEVBQUU7Z0JBQ2ZRLFFBQVFSLElBQUksQ0FBU0ssRUFBRSxHQUFHTyxNQUFNUCxFQUFFO2dCQUNsQ0csUUFBUVIsSUFBSSxDQUFTTSxJQUFJLEdBQUdNLE1BQU1OLElBQUk7Z0JBQ3RDRSxRQUFRUixJQUFJLENBQVNPLFVBQVUsR0FBR0ssTUFBTUwsVUFBVTtZQUNyRDtZQUNBLE9BQU9DO1FBQ1Q7SUFDRjtJQUNBSyxPQUFPO1FBQUVDLFFBQVE7SUFBUztJQUMxQkMsUUFBUUMsUUFBUUMsR0FBRyxDQUFDQyxlQUFlO0FBQ3JDLEVBQUUiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly92ZXppbi1hcHAvLi9saWIvYXV0aC50cz9iZjdlIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IE5leHRBdXRoT3B0aW9ucyB9IGZyb20gXCJuZXh0LWF1dGhcIjtcbmltcG9ydCBDcmVkZW50aWFsc1Byb3ZpZGVyIGZyb20gXCJuZXh0LWF1dGgvcHJvdmlkZXJzL2NyZWRlbnRpYWxzXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi9wcmlzbWFcIjtcbmltcG9ydCBiY3J5cHQgZnJvbSBcImJjcnlwdGpzXCI7XG5cbmV4cG9ydCBjb25zdCBhdXRoT3B0aW9uczogTmV4dEF1dGhPcHRpb25zID0ge1xuICBwcm92aWRlcnM6IFtcbiAgICBDcmVkZW50aWFsc1Byb3ZpZGVyKHtcbiAgICAgIG5hbWU6IFwiQ3JlZGVudGlhbHNcIixcbiAgICAgIGNyZWRlbnRpYWxzOiB7XG4gICAgICAgIGVtYWlsOiB7IGxhYmVsOiBcIkUtcG9zdGFcIiwgdHlwZTogXCJlbWFpbFwiIH0sXG4gICAgICAgIHBhc3N3b3JkOiB7IGxhYmVsOiBcIsWeaWZyZVwiLCB0eXBlOiBcInBhc3N3b3JkXCIgfSxcbiAgICAgIH0sXG4gICAgICBhc3luYyBhdXRob3JpemUoY3JlZGVudGlhbHMpIHtcbiAgICAgICAgaWYgKCFjcmVkZW50aWFscz8uZW1haWwgfHwgIWNyZWRlbnRpYWxzPy5wYXNzd29yZCkgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgICAgICAgIHdoZXJlOiB7IGVtYWlsOiBjcmVkZW50aWFscy5lbWFpbCB9LFxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKCF1c2VyKSByZXR1cm4gbnVsbDtcblxuICAgICAgICBjb25zdCB2YWxpZCA9IGF3YWl0IGJjcnlwdC5jb21wYXJlKGNyZWRlbnRpYWxzLnBhc3N3b3JkLCB1c2VyLnBhc3N3b3JkKTtcbiAgICAgICAgaWYgKCF2YWxpZCkgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBpZDogdXNlci5pZCxcbiAgICAgICAgICBuYW1lOiB1c2VyLm5hbWUsXG4gICAgICAgICAgZW1haWw6IHVzZXIuZW1haWwsXG4gICAgICAgICAgcm9sZTogdXNlci5yb2xlIGFzIFwiQURNSU5cIiB8IFwiTUFOQUdFUlwiIHwgXCJFTVBMT1lFRVwiLFxuICAgICAgICAgIGRlcGFydG1lbnQ6IHVzZXIuZGVwYXJ0bWVudCxcbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgfSksXG4gIF0sXG4gIHNlc3Npb246IHsgc3RyYXRlZ3k6IFwiand0XCIgfSxcbiAgY2FsbGJhY2tzOiB7XG4gICAgand0KHsgdG9rZW4sIHVzZXIgfSkge1xuICAgICAgaWYgKHVzZXIpIHtcbiAgICAgICAgdG9rZW4uaWQgPSB1c2VyLmlkO1xuICAgICAgICB0b2tlbi5yb2xlID0gKHVzZXIgYXMgYW55KS5yb2xlO1xuICAgICAgICB0b2tlbi5kZXBhcnRtZW50ID0gKHVzZXIgYXMgYW55KS5kZXBhcnRtZW50O1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRva2VuO1xuICAgIH0sXG4gICAgc2Vzc2lvbih7IHNlc3Npb24sIHRva2VuIH0pIHtcbiAgICAgIGlmIChzZXNzaW9uLnVzZXIpIHtcbiAgICAgICAgKHNlc3Npb24udXNlciBhcyBhbnkpLmlkID0gdG9rZW4uaWQgYXMgc3RyaW5nO1xuICAgICAgICAoc2Vzc2lvbi51c2VyIGFzIGFueSkucm9sZSA9IHRva2VuLnJvbGUgYXMgc3RyaW5nO1xuICAgICAgICAoc2Vzc2lvbi51c2VyIGFzIGFueSkuZGVwYXJ0bWVudCA9IHRva2VuLmRlcGFydG1lbnQgYXMgc3RyaW5nO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHNlc3Npb247XG4gICAgfSxcbiAgfSxcbiAgcGFnZXM6IHsgc2lnbkluOiBcIi9sb2dpblwiIH0sXG4gIHNlY3JldDogcHJvY2Vzcy5lbnYuTkVYVEFVVEhfU0VDUkVULFxufTtcbiJdLCJuYW1lcyI6WyJDcmVkZW50aWFsc1Byb3ZpZGVyIiwicHJpc21hIiwiYmNyeXB0IiwiYXV0aE9wdGlvbnMiLCJwcm92aWRlcnMiLCJuYW1lIiwiY3JlZGVudGlhbHMiLCJlbWFpbCIsImxhYmVsIiwidHlwZSIsInBhc3N3b3JkIiwiYXV0aG9yaXplIiwidXNlciIsImZpbmRVbmlxdWUiLCJ3aGVyZSIsInZhbGlkIiwiY29tcGFyZSIsImlkIiwicm9sZSIsImRlcGFydG1lbnQiLCJzZXNzaW9uIiwic3RyYXRlZ3kiLCJjYWxsYmFja3MiLCJqd3QiLCJ0b2tlbiIsInBhZ2VzIiwic2lnbkluIiwic2VjcmV0IiwicHJvY2VzcyIsImVudiIsIk5FWFRBVVRIX1NFQ1JFVCJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./lib/auth.ts\n");

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
var __webpack_require__ = require("../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next","vendor-chunks/next-auth","vendor-chunks/@babel","vendor-chunks/jose","vendor-chunks/openid-client","vendor-chunks/bcryptjs","vendor-chunks/oauth","vendor-chunks/object-hash","vendor-chunks/preact","vendor-chunks/uuid","vendor-chunks/yallist","vendor-chunks/preact-render-to-string","vendor-chunks/lru-cache","vendor-chunks/cookie","vendor-chunks/oidc-token-hash","vendor-chunks/@panva"], () => (__webpack_exec__("(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fdashboard%2Froute&page=%2Fapi%2Fdashboard%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fdashboard%2Froute.ts&appDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!")));
module.exports = __webpack_exports__;

})();