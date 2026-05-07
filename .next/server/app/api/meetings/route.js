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
exports.id = "app/api/meetings/route";
exports.ids = ["app/api/meetings/route"];
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

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fmeetings%2Froute&page=%2Fapi%2Fmeetings%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fmeetings%2Froute.ts&appDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!":
/*!************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fmeetings%2Froute&page=%2Fapi%2Fmeetings%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fmeetings%2Froute.ts&appDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D! ***!
  \************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   originalPathname: () => (/* binding */ originalPathname),\n/* harmony export */   patchFetch: () => (/* binding */ patchFetch),\n/* harmony export */   requestAsyncStorage: () => (/* binding */ requestAsyncStorage),\n/* harmony export */   routeModule: () => (/* binding */ routeModule),\n/* harmony export */   serverHooks: () => (/* binding */ serverHooks),\n/* harmony export */   staticGenerationAsyncStorage: () => (/* binding */ staticGenerationAsyncStorage)\n/* harmony export */ });\n/* harmony import */ var next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/server/future/route-modules/app-route/module.compiled */ \"(rsc)/./node_modules/next/dist/server/future/route-modules/app-route/module.compiled.js\");\n/* harmony import */ var next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/future/route-kind */ \"(rsc)/./node_modules/next/dist/server/future/route-kind.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/server/lib/patch-fetch */ \"(rsc)/./node_modules/next/dist/server/lib/patch-fetch.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var C_Users_Kullan_c_vezin_app_app_api_meetings_route_ts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./app/api/meetings/route.ts */ \"(rsc)/./app/api/meetings/route.ts\");\n\n\n\n\n// We inject the nextConfigOutput here so that we can use them in the route\n// module.\nconst nextConfigOutput = \"\"\nconst routeModule = new next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__.AppRouteRouteModule({\n    definition: {\n        kind: next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind.APP_ROUTE,\n        page: \"/api/meetings/route\",\n        pathname: \"/api/meetings\",\n        filename: \"route\",\n        bundlePath: \"app/api/meetings/route\"\n    },\n    resolvedPagePath: \"C:\\\\Users\\\\Kullanıcı\\\\vezin-app\\\\app\\\\api\\\\meetings\\\\route.ts\",\n    nextConfigOutput,\n    userland: C_Users_Kullan_c_vezin_app_app_api_meetings_route_ts__WEBPACK_IMPORTED_MODULE_3__\n});\n// Pull out the exports that we need to expose from the module. This should\n// be eliminated when we've moved the other routes to the new format. These\n// are used to hook into the route.\nconst { requestAsyncStorage, staticGenerationAsyncStorage, serverHooks } = routeModule;\nconst originalPathname = \"/api/meetings/route\";\nfunction patchFetch() {\n    return (0,next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__.patchFetch)({\n        serverHooks,\n        staticGenerationAsyncStorage\n    });\n}\n\n\n//# sourceMappingURL=app-route.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvbmV4dC9kaXN0L2J1aWxkL3dlYnBhY2svbG9hZGVycy9uZXh0LWFwcC1sb2FkZXIuanM/bmFtZT1hcHAlMkZhcGklMkZtZWV0aW5ncyUyRnJvdXRlJnBhZ2U9JTJGYXBpJTJGbWVldGluZ3MlMkZyb3V0ZSZhcHBQYXRocz0mcGFnZVBhdGg9cHJpdmF0ZS1uZXh0LWFwcC1kaXIlMkZhcGklMkZtZWV0aW5ncyUyRnJvdXRlLnRzJmFwcERpcj1DJTNBJTVDVXNlcnMlNUNLdWxsYW4lQzQlQjFjJUM0JUIxJTVDdmV6aW4tYXBwJTVDYXBwJnBhZ2VFeHRlbnNpb25zPXRzeCZwYWdlRXh0ZW5zaW9ucz10cyZwYWdlRXh0ZW5zaW9ucz1qc3gmcGFnZUV4dGVuc2lvbnM9anMmcm9vdERpcj1DJTNBJTVDVXNlcnMlNUNLdWxsYW4lQzQlQjFjJUM0JUIxJTVDdmV6aW4tYXBwJmlzRGV2PXRydWUmdHNjb25maWdQYXRoPXRzY29uZmlnLmpzb24mYmFzZVBhdGg9JmFzc2V0UHJlZml4PSZuZXh0Q29uZmlnT3V0cHV0PSZwcmVmZXJyZWRSZWdpb249Jm1pZGRsZXdhcmVDb25maWc9ZTMwJTNEISIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUFBc0c7QUFDdkM7QUFDYztBQUNhO0FBQzFGO0FBQ0E7QUFDQTtBQUNBLHdCQUF3QixnSEFBbUI7QUFDM0M7QUFDQSxjQUFjLHlFQUFTO0FBQ3ZCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQSxZQUFZO0FBQ1osQ0FBQztBQUNEO0FBQ0E7QUFDQTtBQUNBLFFBQVEsaUVBQWlFO0FBQ3pFO0FBQ0E7QUFDQSxXQUFXLDRFQUFXO0FBQ3RCO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDdUg7O0FBRXZIIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vdmV6aW4tYXBwLz9kNWQ5Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFwcFJvdXRlUm91dGVNb2R1bGUgfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9mdXR1cmUvcm91dGUtbW9kdWxlcy9hcHAtcm91dGUvbW9kdWxlLmNvbXBpbGVkXCI7XG5pbXBvcnQgeyBSb3V0ZUtpbmQgfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9mdXR1cmUvcm91dGUta2luZFwiO1xuaW1wb3J0IHsgcGF0Y2hGZXRjaCBhcyBfcGF0Y2hGZXRjaCB9IGZyb20gXCJuZXh0L2Rpc3Qvc2VydmVyL2xpYi9wYXRjaC1mZXRjaFwiO1xuaW1wb3J0ICogYXMgdXNlcmxhbmQgZnJvbSBcIkM6XFxcXFVzZXJzXFxcXEt1bGxhbsSxY8SxXFxcXHZlemluLWFwcFxcXFxhcHBcXFxcYXBpXFxcXG1lZXRpbmdzXFxcXHJvdXRlLnRzXCI7XG4vLyBXZSBpbmplY3QgdGhlIG5leHRDb25maWdPdXRwdXQgaGVyZSBzbyB0aGF0IHdlIGNhbiB1c2UgdGhlbSBpbiB0aGUgcm91dGVcbi8vIG1vZHVsZS5cbmNvbnN0IG5leHRDb25maWdPdXRwdXQgPSBcIlwiXG5jb25zdCByb3V0ZU1vZHVsZSA9IG5ldyBBcHBSb3V0ZVJvdXRlTW9kdWxlKHtcbiAgICBkZWZpbml0aW9uOiB7XG4gICAgICAgIGtpbmQ6IFJvdXRlS2luZC5BUFBfUk9VVEUsXG4gICAgICAgIHBhZ2U6IFwiL2FwaS9tZWV0aW5ncy9yb3V0ZVwiLFxuICAgICAgICBwYXRobmFtZTogXCIvYXBpL21lZXRpbmdzXCIsXG4gICAgICAgIGZpbGVuYW1lOiBcInJvdXRlXCIsXG4gICAgICAgIGJ1bmRsZVBhdGg6IFwiYXBwL2FwaS9tZWV0aW5ncy9yb3V0ZVwiXG4gICAgfSxcbiAgICByZXNvbHZlZFBhZ2VQYXRoOiBcIkM6XFxcXFVzZXJzXFxcXEt1bGxhbsSxY8SxXFxcXHZlemluLWFwcFxcXFxhcHBcXFxcYXBpXFxcXG1lZXRpbmdzXFxcXHJvdXRlLnRzXCIsXG4gICAgbmV4dENvbmZpZ091dHB1dCxcbiAgICB1c2VybGFuZFxufSk7XG4vLyBQdWxsIG91dCB0aGUgZXhwb3J0cyB0aGF0IHdlIG5lZWQgdG8gZXhwb3NlIGZyb20gdGhlIG1vZHVsZS4gVGhpcyBzaG91bGRcbi8vIGJlIGVsaW1pbmF0ZWQgd2hlbiB3ZSd2ZSBtb3ZlZCB0aGUgb3RoZXIgcm91dGVzIHRvIHRoZSBuZXcgZm9ybWF0LiBUaGVzZVxuLy8gYXJlIHVzZWQgdG8gaG9vayBpbnRvIHRoZSByb3V0ZS5cbmNvbnN0IHsgcmVxdWVzdEFzeW5jU3RvcmFnZSwgc3RhdGljR2VuZXJhdGlvbkFzeW5jU3RvcmFnZSwgc2VydmVySG9va3MgfSA9IHJvdXRlTW9kdWxlO1xuY29uc3Qgb3JpZ2luYWxQYXRobmFtZSA9IFwiL2FwaS9tZWV0aW5ncy9yb3V0ZVwiO1xuZnVuY3Rpb24gcGF0Y2hGZXRjaCgpIHtcbiAgICByZXR1cm4gX3BhdGNoRmV0Y2goe1xuICAgICAgICBzZXJ2ZXJIb29rcyxcbiAgICAgICAgc3RhdGljR2VuZXJhdGlvbkFzeW5jU3RvcmFnZVxuICAgIH0pO1xufVxuZXhwb3J0IHsgcm91dGVNb2R1bGUsIHJlcXVlc3RBc3luY1N0b3JhZ2UsIHN0YXRpY0dlbmVyYXRpb25Bc3luY1N0b3JhZ2UsIHNlcnZlckhvb2tzLCBvcmlnaW5hbFBhdGhuYW1lLCBwYXRjaEZldGNoLCAgfTtcblxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YXBwLXJvdXRlLmpzLm1hcCJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fmeetings%2Froute&page=%2Fapi%2Fmeetings%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fmeetings%2Froute.ts&appDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!\n");

/***/ }),

/***/ "(rsc)/./app/api/meetings/route.ts":
/*!***********************************!*\
  !*** ./app/api/meetings/route.ts ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   GET: () => (/* binding */ GET),\n/* harmony export */   POST: () => (/* binding */ POST)\n/* harmony export */ });\n/* harmony import */ var next_server__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/server */ \"(rsc)/./node_modules/next/dist/api/server.js\");\n/* harmony import */ var next_auth__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next-auth */ \"(rsc)/./node_modules/next-auth/index.js\");\n/* harmony import */ var next_auth__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(next_auth__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var _lib_auth__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @/lib/auth */ \"(rsc)/./lib/auth.ts\");\n/* harmony import */ var _lib_prisma__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @/lib/prisma */ \"(rsc)/./lib/prisma.ts\");\n\n\n\n\nconst VALID_DEPARTMENTS = [\n    \"OUTSOURCE\",\n    \"BAGIMSIZ_DENETIM\",\n    \"MUHASEBE\",\n    \"YEMINLI_MALI_MUSAVIR\",\n    \"ADMIN\"\n];\nconst VALID_DURATIONS = [\n    30,\n    60,\n    120\n];\n// GET /api/meetings?year=2026&month=5\nasync function GET(req) {\n    const session = await (0,next_auth__WEBPACK_IMPORTED_MODULE_1__.getServerSession)(_lib_auth__WEBPACK_IMPORTED_MODULE_2__.authOptions);\n    if (!session) return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n        error: \"Yetkisiz\"\n    }, {\n        status: 401\n    });\n    const { searchParams } = new URL(req.url);\n    const year = parseInt(searchParams.get(\"year\") ?? String(new Date().getFullYear()));\n    const month = parseInt(searchParams.get(\"month\") ?? String(new Date().getMonth() + 1));\n    const prefix = `${year}-${String(month).padStart(2, \"0\")}`;\n    const meetings = await _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.meeting.findMany({\n        where: {\n            date: {\n                startsWith: prefix\n            }\n        },\n        include: {\n            createdBy: {\n                select: {\n                    id: true,\n                    name: true\n                }\n            }\n        },\n        orderBy: [\n            {\n                date: \"asc\"\n            },\n            {\n                time: \"asc\"\n            }\n        ]\n    });\n    // Group by date\n    const meetingsByDay = {};\n    for (const m of meetings){\n        if (!meetingsByDay[m.date]) meetingsByDay[m.date] = [];\n        meetingsByDay[m.date].push(m);\n    }\n    return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n        meetingsByDay\n    });\n}\n// POST /api/meetings — sadece ADMIN ve MANAGER\nasync function POST(req) {\n    const session = await (0,next_auth__WEBPACK_IMPORTED_MODULE_1__.getServerSession)(_lib_auth__WEBPACK_IMPORTED_MODULE_2__.authOptions);\n    if (!session) return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n        error: \"Yetkisiz\"\n    }, {\n        status: 401\n    });\n    const role = session.user.role;\n    if (role !== \"ADMIN\" && role !== \"MANAGER\") {\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            error: \"Sadece y\\xf6netici veya admin toplantı oluşturabilir\"\n        }, {\n            status: 403\n        });\n    }\n    const createdById = session.user.id;\n    const sessionDepartment = session.user.department;\n    const body = await req.json();\n    const { title, description, date, time, duration } = body;\n    // MANAGER kendi departmanını kullanır, ADMIN istediği departmanı seçebilir\n    const department = role === \"MANAGER\" ? sessionDepartment : body.department;\n    if (!title?.trim() || !date || !time || !department) {\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            error: \"Başlık, tarih, saat ve departman zorunlu\"\n        }, {\n            status: 400\n        });\n    }\n    // Validate date format YYYY-MM-DD\n    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) {\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            error: \"Tarih formatı ge\\xe7ersiz (YYYY-MM-DD)\"\n        }, {\n            status: 400\n        });\n    }\n    // Validate time format HH:MM\n    if (!/^\\d{2}:\\d{2}$/.test(time)) {\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            error: \"Saat formatı ge\\xe7ersiz (HH:MM)\"\n        }, {\n            status: 400\n        });\n    }\n    const dur = Number(duration);\n    if (!VALID_DURATIONS.includes(dur)) {\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            error: \"Ge\\xe7ersiz s\\xfcre\"\n        }, {\n            status: 400\n        });\n    }\n    if (!VALID_DEPARTMENTS.includes(department)) {\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            error: \"Ge\\xe7ersiz departman\"\n        }, {\n            status: 400\n        });\n    }\n    // Create meeting\n    const meeting = await _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.meeting.create({\n        data: {\n            title: title.trim(),\n            description: description?.trim() || null,\n            date,\n            time,\n            duration: dur,\n            department,\n            createdById\n        },\n        include: {\n            createdBy: {\n                select: {\n                    id: true,\n                    name: true\n                }\n            }\n        }\n    });\n    // Find all users in the department to notify\n    const deptUsers = await _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.user.findMany({\n        where: {\n            department\n        },\n        select: {\n            id: true\n        }\n    });\n    const notifMessage = `YENİ TOPLANTI: ${meeting.title} - ${date} ${time}`;\n    // Create attendees + notifications in parallel\n    await Promise.all([\n        // Bulk create attendees\n        _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.meetingAttendee.createMany({\n            data: deptUsers.map((u)=>({\n                    meetingId: meeting.id,\n                    userId: u.id,\n                    status: \"PENDING\"\n                })),\n            skipDuplicates: true\n        }),\n        // Bulk create notifications\n        _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.notification.createMany({\n            data: deptUsers.map((u)=>({\n                    userId: u.id,\n                    type: \"MEETING_CREATED\",\n                    message: notifMessage,\n                    relatedId: meeting.id\n                }))\n        })\n    ]);\n    return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json(meeting, {\n        status: 201\n    });\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9hcHAvYXBpL21lZXRpbmdzL3JvdXRlLnRzIiwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBd0Q7QUFDWDtBQUNKO0FBQ0g7QUFFdEMsTUFBTUksb0JBQW9CO0lBQ3hCO0lBQWE7SUFBb0I7SUFBWTtJQUF3QjtDQUN0RTtBQUNELE1BQU1DLGtCQUFrQjtJQUFDO0lBQUk7SUFBSTtDQUFJO0FBRXJDLHNDQUFzQztBQUMvQixlQUFlQyxJQUFJQyxHQUFnQjtJQUN4QyxNQUFNQyxVQUFVLE1BQU1QLDJEQUFnQkEsQ0FBQ0Msa0RBQVdBO0lBQ2xELElBQUksQ0FBQ00sU0FBUyxPQUFPUixxREFBWUEsQ0FBQ1MsSUFBSSxDQUFDO1FBQUVDLE9BQU87SUFBVyxHQUFHO1FBQUVDLFFBQVE7SUFBSTtJQUU1RSxNQUFNLEVBQUVDLFlBQVksRUFBRSxHQUFHLElBQUlDLElBQUlOLElBQUlPLEdBQUc7SUFDeEMsTUFBTUMsT0FBT0MsU0FBU0osYUFBYUssR0FBRyxDQUFDLFdBQVdDLE9BQU8sSUFBSUMsT0FBT0MsV0FBVztJQUMvRSxNQUFNQyxRQUFRTCxTQUFTSixhQUFhSyxHQUFHLENBQUMsWUFBWUMsT0FBTyxJQUFJQyxPQUFPRyxRQUFRLEtBQUs7SUFFbkYsTUFBTUMsU0FBUyxDQUFDLEVBQUVSLEtBQUssQ0FBQyxFQUFFRyxPQUFPRyxPQUFPRyxRQUFRLENBQUMsR0FBRyxLQUFLLENBQUM7SUFFMUQsTUFBTUMsV0FBVyxNQUFNLGdEQUFnQkMsT0FBTyxDQUFDQyxRQUFRLENBQUM7UUFDdERDLE9BQU87WUFBRUMsTUFBTTtnQkFBRUMsWUFBWVA7WUFBTztRQUFFO1FBQ3RDUSxTQUFTO1lBQUVDLFdBQVc7Z0JBQUVDLFFBQVE7b0JBQUVDLElBQUk7b0JBQU1DLE1BQU07Z0JBQUs7WUFBRTtRQUFFO1FBQzNEQyxTQUFTO1lBQUM7Z0JBQUVQLE1BQU07WUFBTTtZQUFHO2dCQUFFUSxNQUFNO1lBQU07U0FBRTtJQUM3QztJQUVBLGdCQUFnQjtJQUNoQixNQUFNQyxnQkFBaUQsQ0FBQztJQUN4RCxLQUFLLE1BQU1DLEtBQUtkLFNBQVU7UUFDeEIsSUFBSSxDQUFDYSxhQUFhLENBQUNDLEVBQUVWLElBQUksQ0FBQyxFQUFFUyxhQUFhLENBQUNDLEVBQUVWLElBQUksQ0FBQyxHQUFHLEVBQUU7UUFDdERTLGFBQWEsQ0FBQ0MsRUFBRVYsSUFBSSxDQUFDLENBQUNXLElBQUksQ0FBQ0Q7SUFDN0I7SUFFQSxPQUFPdkMscURBQVlBLENBQUNTLElBQUksQ0FBQztRQUFFNkI7SUFBYztBQUMzQztBQUVBLCtDQUErQztBQUN4QyxlQUFlRyxLQUFLbEMsR0FBZ0I7SUFDekMsTUFBTUMsVUFBVSxNQUFNUCwyREFBZ0JBLENBQUNDLGtEQUFXQTtJQUNsRCxJQUFJLENBQUNNLFNBQVMsT0FBT1IscURBQVlBLENBQUNTLElBQUksQ0FBQztRQUFFQyxPQUFPO0lBQVcsR0FBRztRQUFFQyxRQUFRO0lBQUk7SUFFNUUsTUFBTStCLE9BQU8sUUFBU0MsSUFBSSxDQUFTRCxJQUFJO0lBQ3ZDLElBQUlBLFNBQVMsV0FBV0EsU0FBUyxXQUFXO1FBQzFDLE9BQU8xQyxxREFBWUEsQ0FBQ1MsSUFBSSxDQUFDO1lBQUVDLE9BQU87UUFBb0QsR0FBRztZQUFFQyxRQUFRO1FBQUk7SUFDekc7SUFFQSxNQUFNaUMsY0FBYyxRQUFTRCxJQUFJLENBQVNULEVBQUU7SUFDNUMsTUFBTVcsb0JBQW9CLFFBQVNGLElBQUksQ0FBU0csVUFBVTtJQUMxRCxNQUFNQyxPQUFPLE1BQU14QyxJQUFJRSxJQUFJO0lBRTNCLE1BQU0sRUFBRXVDLEtBQUssRUFBRUMsV0FBVyxFQUFFcEIsSUFBSSxFQUFFUSxJQUFJLEVBQUVhLFFBQVEsRUFBRSxHQUFHSDtJQUNyRCwyRUFBMkU7SUFDM0UsTUFBTUQsYUFBYUosU0FBUyxZQUFZRyxvQkFBb0JFLEtBQUtELFVBQVU7SUFFM0UsSUFBSSxDQUFDRSxPQUFPRyxVQUFVLENBQUN0QixRQUFRLENBQUNRLFFBQVEsQ0FBQ1MsWUFBWTtRQUNuRCxPQUFPOUMscURBQVlBLENBQUNTLElBQUksQ0FBQztZQUFFQyxPQUFPO1FBQTJDLEdBQUc7WUFBRUMsUUFBUTtRQUFJO0lBQ2hHO0lBRUEsa0NBQWtDO0lBQ2xDLElBQUksQ0FBQyxzQkFBc0J5QyxJQUFJLENBQUN2QixPQUFPO1FBQ3JDLE9BQU83QixxREFBWUEsQ0FBQ1MsSUFBSSxDQUFDO1lBQUVDLE9BQU87UUFBc0MsR0FBRztZQUFFQyxRQUFRO1FBQUk7SUFDM0Y7SUFFQSw2QkFBNkI7SUFDN0IsSUFBSSxDQUFDLGdCQUFnQnlDLElBQUksQ0FBQ2YsT0FBTztRQUMvQixPQUFPckMscURBQVlBLENBQUNTLElBQUksQ0FBQztZQUFFQyxPQUFPO1FBQWdDLEdBQUc7WUFBRUMsUUFBUTtRQUFJO0lBQ3JGO0lBRUEsTUFBTTBDLE1BQU1DLE9BQU9KO0lBQ25CLElBQUksQ0FBQzdDLGdCQUFnQmtELFFBQVEsQ0FBQ0YsTUFBTTtRQUNsQyxPQUFPckQscURBQVlBLENBQUNTLElBQUksQ0FBQztZQUFFQyxPQUFPO1FBQWdCLEdBQUc7WUFBRUMsUUFBUTtRQUFJO0lBQ3JFO0lBRUEsSUFBSSxDQUFDUCxrQkFBa0JtRCxRQUFRLENBQUNULGFBQWE7UUFDM0MsT0FBTzlDLHFEQUFZQSxDQUFDUyxJQUFJLENBQUM7WUFBRUMsT0FBTztRQUFxQixHQUFHO1lBQUVDLFFBQVE7UUFBSTtJQUMxRTtJQUVBLGlCQUFpQjtJQUNqQixNQUFNZSxVQUFVLE1BQU0sZ0RBQWdCQSxPQUFPLENBQUM4QixNQUFNLENBQUM7UUFDbkRDLE1BQU07WUFDSlQsT0FBT0EsTUFBTUcsSUFBSTtZQUNqQkYsYUFBYUEsYUFBYUUsVUFBVTtZQUNwQ3RCO1lBQ0FRO1lBQ0FhLFVBQVVHO1lBQ1ZQO1lBQ0FGO1FBQ0Y7UUFDQWIsU0FBUztZQUFFQyxXQUFXO2dCQUFFQyxRQUFRO29CQUFFQyxJQUFJO29CQUFNQyxNQUFNO2dCQUFLO1lBQUU7UUFBRTtJQUM3RDtJQUVBLDZDQUE2QztJQUM3QyxNQUFNdUIsWUFBWSxNQUFNdkQsK0NBQU1BLENBQUN3QyxJQUFJLENBQUNoQixRQUFRLENBQUM7UUFDM0NDLE9BQU87WUFBRWtCO1FBQVc7UUFDcEJiLFFBQVE7WUFBRUMsSUFBSTtRQUFLO0lBQ3JCO0lBRUEsTUFBTXlCLGVBQWUsQ0FBQyxlQUFlLEVBQUVqQyxRQUFRc0IsS0FBSyxDQUFDLEdBQUcsRUFBRW5CLEtBQUssQ0FBQyxFQUFFUSxLQUFLLENBQUM7SUFFeEUsK0NBQStDO0lBQy9DLE1BQU11QixRQUFRQyxHQUFHLENBQUM7UUFDaEIsd0JBQXdCO1FBQ3ZCMUQsK0NBQU1BLENBQVMyRCxlQUFlLENBQUNDLFVBQVUsQ0FBQztZQUN6Q04sTUFBTUMsVUFBVU0sR0FBRyxDQUFDLENBQUNDLElBQXVCO29CQUMxQ0MsV0FBV3hDLFFBQVFRLEVBQUU7b0JBQ3JCaUMsUUFBUUYsRUFBRS9CLEVBQUU7b0JBQ1p2QixRQUFRO2dCQUNWO1lBQ0F5RCxnQkFBZ0I7UUFDbEI7UUFDQSw0QkFBNEI7UUFDNUJqRSwrQ0FBTUEsQ0FBQ2tFLFlBQVksQ0FBQ04sVUFBVSxDQUFDO1lBQzdCTixNQUFNQyxVQUFVTSxHQUFHLENBQUMsQ0FBQ0MsSUFBdUI7b0JBQzFDRSxRQUFRRixFQUFFL0IsRUFBRTtvQkFDWm9DLE1BQU07b0JBQ05DLFNBQVNaO29CQUNUYSxXQUFXOUMsUUFBUVEsRUFBRTtnQkFDdkI7UUFDRjtLQUNEO0lBRUQsT0FBT2xDLHFEQUFZQSxDQUFDUyxJQUFJLENBQUNpQixTQUFTO1FBQUVmLFFBQVE7SUFBSTtBQUNsRCIsInNvdXJjZXMiOlsid2VicGFjazovL3ZlemluLWFwcC8uL2FwcC9hcGkvbWVldGluZ3Mvcm91dGUudHM/ZDVmMiJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBOZXh0UmVxdWVzdCwgTmV4dFJlc3BvbnNlIH0gZnJvbSBcIm5leHQvc2VydmVyXCI7XG5pbXBvcnQgeyBnZXRTZXJ2ZXJTZXNzaW9uIH0gZnJvbSBcIm5leHQtYXV0aFwiO1xuaW1wb3J0IHsgYXV0aE9wdGlvbnMgfSBmcm9tIFwiQC9saWIvYXV0aFwiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIkAvbGliL3ByaXNtYVwiO1xuXG5jb25zdCBWQUxJRF9ERVBBUlRNRU5UUyA9IFtcbiAgXCJPVVRTT1VSQ0VcIiwgXCJCQUdJTVNJWl9ERU5FVElNXCIsIFwiTVVIQVNFQkVcIiwgXCJZRU1JTkxJX01BTElfTVVTQVZJUlwiLCBcIkFETUlOXCIsXG5dO1xuY29uc3QgVkFMSURfRFVSQVRJT05TID0gWzMwLCA2MCwgMTIwXTtcblxuLy8gR0VUIC9hcGkvbWVldGluZ3M/eWVhcj0yMDI2Jm1vbnRoPTVcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBHRVQocmVxOiBOZXh0UmVxdWVzdCkge1xuICBjb25zdCBzZXNzaW9uID0gYXdhaXQgZ2V0U2VydmVyU2Vzc2lvbihhdXRoT3B0aW9ucyk7XG4gIGlmICghc2Vzc2lvbikgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgZXJyb3I6IFwiWWV0a2lzaXpcIiB9LCB7IHN0YXR1czogNDAxIH0pO1xuXG4gIGNvbnN0IHsgc2VhcmNoUGFyYW1zIH0gPSBuZXcgVVJMKHJlcS51cmwpO1xuICBjb25zdCB5ZWFyID0gcGFyc2VJbnQoc2VhcmNoUGFyYW1zLmdldChcInllYXJcIikgPz8gU3RyaW5nKG5ldyBEYXRlKCkuZ2V0RnVsbFllYXIoKSkpO1xuICBjb25zdCBtb250aCA9IHBhcnNlSW50KHNlYXJjaFBhcmFtcy5nZXQoXCJtb250aFwiKSA/PyBTdHJpbmcobmV3IERhdGUoKS5nZXRNb250aCgpICsgMSkpO1xuXG4gIGNvbnN0IHByZWZpeCA9IGAke3llYXJ9LSR7U3RyaW5nKG1vbnRoKS5wYWRTdGFydCgyLCBcIjBcIil9YDtcblxuICBjb25zdCBtZWV0aW5ncyA9IGF3YWl0IChwcmlzbWEgYXMgYW55KS5tZWV0aW5nLmZpbmRNYW55KHtcbiAgICB3aGVyZTogeyBkYXRlOiB7IHN0YXJ0c1dpdGg6IHByZWZpeCB9IH0sXG4gICAgaW5jbHVkZTogeyBjcmVhdGVkQnk6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlIH0gfSB9LFxuICAgIG9yZGVyQnk6IFt7IGRhdGU6IFwiYXNjXCIgfSwgeyB0aW1lOiBcImFzY1wiIH1dLFxuICB9KTtcblxuICAvLyBHcm91cCBieSBkYXRlXG4gIGNvbnN0IG1lZXRpbmdzQnlEYXk6IFJlY29yZDxzdHJpbmcsIHR5cGVvZiBtZWV0aW5ncz4gPSB7fTtcbiAgZm9yIChjb25zdCBtIG9mIG1lZXRpbmdzKSB7XG4gICAgaWYgKCFtZWV0aW5nc0J5RGF5W20uZGF0ZV0pIG1lZXRpbmdzQnlEYXlbbS5kYXRlXSA9IFtdO1xuICAgIG1lZXRpbmdzQnlEYXlbbS5kYXRlXS5wdXNoKG0pO1xuICB9XG5cbiAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgbWVldGluZ3NCeURheSB9KTtcbn1cblxuLy8gUE9TVCAvYXBpL21lZXRpbmdzIOKAlCBzYWRlY2UgQURNSU4gdmUgTUFOQUdFUlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIFBPU1QocmVxOiBOZXh0UmVxdWVzdCkge1xuICBjb25zdCBzZXNzaW9uID0gYXdhaXQgZ2V0U2VydmVyU2Vzc2lvbihhdXRoT3B0aW9ucyk7XG4gIGlmICghc2Vzc2lvbikgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgZXJyb3I6IFwiWWV0a2lzaXpcIiB9LCB7IHN0YXR1czogNDAxIH0pO1xuXG4gIGNvbnN0IHJvbGUgPSAoc2Vzc2lvbi51c2VyIGFzIGFueSkucm9sZSBhcyBzdHJpbmc7XG4gIGlmIChyb2xlICE9PSBcIkFETUlOXCIgJiYgcm9sZSAhPT0gXCJNQU5BR0VSXCIpIHtcbiAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oeyBlcnJvcjogXCJTYWRlY2UgecO2bmV0aWNpIHZleWEgYWRtaW4gdG9wbGFudMSxIG9sdcWfdHVyYWJpbGlyXCIgfSwgeyBzdGF0dXM6IDQwMyB9KTtcbiAgfVxuXG4gIGNvbnN0IGNyZWF0ZWRCeUlkID0gKHNlc3Npb24udXNlciBhcyBhbnkpLmlkIGFzIHN0cmluZztcbiAgY29uc3Qgc2Vzc2lvbkRlcGFydG1lbnQgPSAoc2Vzc2lvbi51c2VyIGFzIGFueSkuZGVwYXJ0bWVudCBhcyBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gIGNvbnN0IGJvZHkgPSBhd2FpdCByZXEuanNvbigpO1xuXG4gIGNvbnN0IHsgdGl0bGUsIGRlc2NyaXB0aW9uLCBkYXRlLCB0aW1lLCBkdXJhdGlvbiB9ID0gYm9keTtcbiAgLy8gTUFOQUdFUiBrZW5kaSBkZXBhcnRtYW7EsW7EsSBrdWxsYW7EsXIsIEFETUlOIGlzdGVkacSfaSBkZXBhcnRtYW7EsSBzZcOnZWJpbGlyXG4gIGNvbnN0IGRlcGFydG1lbnQgPSByb2xlID09PSBcIk1BTkFHRVJcIiA/IHNlc3Npb25EZXBhcnRtZW50IDogYm9keS5kZXBhcnRtZW50O1xuXG4gIGlmICghdGl0bGU/LnRyaW0oKSB8fCAhZGF0ZSB8fCAhdGltZSB8fCAhZGVwYXJ0bWVudCkge1xuICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7IGVycm9yOiBcIkJhxZ9sxLFrLCB0YXJpaCwgc2FhdCB2ZSBkZXBhcnRtYW4gem9ydW5sdVwiIH0sIHsgc3RhdHVzOiA0MDAgfSk7XG4gIH1cblxuICAvLyBWYWxpZGF0ZSBkYXRlIGZvcm1hdCBZWVlZLU1NLUREXG4gIGlmICghL15cXGR7NH0tXFxkezJ9LVxcZHsyfSQvLnRlc3QoZGF0ZSkpIHtcbiAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oeyBlcnJvcjogXCJUYXJpaCBmb3JtYXTEsSBnZcOnZXJzaXogKFlZWVktTU0tREQpXCIgfSwgeyBzdGF0dXM6IDQwMCB9KTtcbiAgfVxuXG4gIC8vIFZhbGlkYXRlIHRpbWUgZm9ybWF0IEhIOk1NXG4gIGlmICghL15cXGR7Mn06XFxkezJ9JC8udGVzdCh0aW1lKSkge1xuICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7IGVycm9yOiBcIlNhYXQgZm9ybWF0xLEgZ2XDp2Vyc2l6IChISDpNTSlcIiB9LCB7IHN0YXR1czogNDAwIH0pO1xuICB9XG5cbiAgY29uc3QgZHVyID0gTnVtYmVyKGR1cmF0aW9uKTtcbiAgaWYgKCFWQUxJRF9EVVJBVElPTlMuaW5jbHVkZXMoZHVyKSkge1xuICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7IGVycm9yOiBcIkdlw6dlcnNpeiBzw7xyZVwiIH0sIHsgc3RhdHVzOiA0MDAgfSk7XG4gIH1cblxuICBpZiAoIVZBTElEX0RFUEFSVE1FTlRTLmluY2x1ZGVzKGRlcGFydG1lbnQpKSB7XG4gICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgZXJyb3I6IFwiR2XDp2Vyc2l6IGRlcGFydG1hblwiIH0sIHsgc3RhdHVzOiA0MDAgfSk7XG4gIH1cblxuICAvLyBDcmVhdGUgbWVldGluZ1xuICBjb25zdCBtZWV0aW5nID0gYXdhaXQgKHByaXNtYSBhcyBhbnkpLm1lZXRpbmcuY3JlYXRlKHtcbiAgICBkYXRhOiB7XG4gICAgICB0aXRsZTogdGl0bGUudHJpbSgpLFxuICAgICAgZGVzY3JpcHRpb246IGRlc2NyaXB0aW9uPy50cmltKCkgfHwgbnVsbCxcbiAgICAgIGRhdGUsXG4gICAgICB0aW1lLFxuICAgICAgZHVyYXRpb246IGR1cixcbiAgICAgIGRlcGFydG1lbnQsXG4gICAgICBjcmVhdGVkQnlJZCxcbiAgICB9LFxuICAgIGluY2x1ZGU6IHsgY3JlYXRlZEJ5OiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSB9IH0gfSxcbiAgfSk7XG5cbiAgLy8gRmluZCBhbGwgdXNlcnMgaW4gdGhlIGRlcGFydG1lbnQgdG8gbm90aWZ5XG4gIGNvbnN0IGRlcHRVc2VycyA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRNYW55KHtcbiAgICB3aGVyZTogeyBkZXBhcnRtZW50IH0sXG4gICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGNvbnN0IG5vdGlmTWVzc2FnZSA9IGBZRU7EsCBUT1BMQU5USTogJHttZWV0aW5nLnRpdGxlfSAtICR7ZGF0ZX0gJHt0aW1lfWA7XG5cbiAgLy8gQ3JlYXRlIGF0dGVuZGVlcyArIG5vdGlmaWNhdGlvbnMgaW4gcGFyYWxsZWxcbiAgYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIC8vIEJ1bGsgY3JlYXRlIGF0dGVuZGVlc1xuICAgIChwcmlzbWEgYXMgYW55KS5tZWV0aW5nQXR0ZW5kZWUuY3JlYXRlTWFueSh7XG4gICAgICBkYXRhOiBkZXB0VXNlcnMubWFwKCh1OiB7IGlkOiBzdHJpbmcgfSkgPT4gKHtcbiAgICAgICAgbWVldGluZ0lkOiBtZWV0aW5nLmlkLFxuICAgICAgICB1c2VySWQ6IHUuaWQsXG4gICAgICAgIHN0YXR1czogXCJQRU5ESU5HXCIsXG4gICAgICB9KSksXG4gICAgICBza2lwRHVwbGljYXRlczogdHJ1ZSxcbiAgICB9KSxcbiAgICAvLyBCdWxrIGNyZWF0ZSBub3RpZmljYXRpb25zXG4gICAgcHJpc21hLm5vdGlmaWNhdGlvbi5jcmVhdGVNYW55KHtcbiAgICAgIGRhdGE6IGRlcHRVc2Vycy5tYXAoKHU6IHsgaWQ6IHN0cmluZyB9KSA9PiAoe1xuICAgICAgICB1c2VySWQ6IHUuaWQsXG4gICAgICAgIHR5cGU6IFwiTUVFVElOR19DUkVBVEVEXCIsXG4gICAgICAgIG1lc3NhZ2U6IG5vdGlmTWVzc2FnZSxcbiAgICAgICAgcmVsYXRlZElkOiBtZWV0aW5nLmlkLFxuICAgICAgfSkpLFxuICAgIH0pLFxuICBdKTtcblxuICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24obWVldGluZywgeyBzdGF0dXM6IDIwMSB9KTtcbn1cbiJdLCJuYW1lcyI6WyJOZXh0UmVzcG9uc2UiLCJnZXRTZXJ2ZXJTZXNzaW9uIiwiYXV0aE9wdGlvbnMiLCJwcmlzbWEiLCJWQUxJRF9ERVBBUlRNRU5UUyIsIlZBTElEX0RVUkFUSU9OUyIsIkdFVCIsInJlcSIsInNlc3Npb24iLCJqc29uIiwiZXJyb3IiLCJzdGF0dXMiLCJzZWFyY2hQYXJhbXMiLCJVUkwiLCJ1cmwiLCJ5ZWFyIiwicGFyc2VJbnQiLCJnZXQiLCJTdHJpbmciLCJEYXRlIiwiZ2V0RnVsbFllYXIiLCJtb250aCIsImdldE1vbnRoIiwicHJlZml4IiwicGFkU3RhcnQiLCJtZWV0aW5ncyIsIm1lZXRpbmciLCJmaW5kTWFueSIsIndoZXJlIiwiZGF0ZSIsInN0YXJ0c1dpdGgiLCJpbmNsdWRlIiwiY3JlYXRlZEJ5Iiwic2VsZWN0IiwiaWQiLCJuYW1lIiwib3JkZXJCeSIsInRpbWUiLCJtZWV0aW5nc0J5RGF5IiwibSIsInB1c2giLCJQT1NUIiwicm9sZSIsInVzZXIiLCJjcmVhdGVkQnlJZCIsInNlc3Npb25EZXBhcnRtZW50IiwiZGVwYXJ0bWVudCIsImJvZHkiLCJ0aXRsZSIsImRlc2NyaXB0aW9uIiwiZHVyYXRpb24iLCJ0cmltIiwidGVzdCIsImR1ciIsIk51bWJlciIsImluY2x1ZGVzIiwiY3JlYXRlIiwiZGF0YSIsImRlcHRVc2VycyIsIm5vdGlmTWVzc2FnZSIsIlByb21pc2UiLCJhbGwiLCJtZWV0aW5nQXR0ZW5kZWUiLCJjcmVhdGVNYW55IiwibWFwIiwidSIsIm1lZXRpbmdJZCIsInVzZXJJZCIsInNraXBEdXBsaWNhdGVzIiwibm90aWZpY2F0aW9uIiwidHlwZSIsIm1lc3NhZ2UiLCJyZWxhdGVkSWQiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./app/api/meetings/route.ts\n");

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
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next","vendor-chunks/next-auth","vendor-chunks/@babel","vendor-chunks/jose","vendor-chunks/openid-client","vendor-chunks/bcryptjs","vendor-chunks/oauth","vendor-chunks/object-hash","vendor-chunks/preact","vendor-chunks/uuid","vendor-chunks/yallist","vendor-chunks/preact-render-to-string","vendor-chunks/lru-cache","vendor-chunks/cookie","vendor-chunks/oidc-token-hash","vendor-chunks/@panva"], () => (__webpack_exec__("(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fmeetings%2Froute&page=%2Fapi%2Fmeetings%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fmeetings%2Froute.ts&appDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!")));
module.exports = __webpack_exports__;

})();