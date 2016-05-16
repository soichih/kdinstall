"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var core_1 = require('@angular/core');
var http_1 = require('@angular/http');
require('rxjs/Rx');
var EventEmitter = nodeRequire('events');
var Broadcaster = (function (_super) {
    __extends(Broadcaster, _super);
    function Broadcaster() {
        _super.apply(this, arguments);
    }
    return Broadcaster;
}(EventEmitter));
exports.Broadcaster = Broadcaster;
var SCAService = (function () {
    function SCAService(http) {
        this.http = http;
    }
    SCAService.prototype.generateSSHKeys = function () {
        return this.http.get(SCAService.PATH + '/resource/gensshkey')
            .map(function (response) { return response.json(); });
    };
    SCAService.prototype.storeSSHKey = function (username, password, pubkey, comment) {
        var headers = new http_1.Headers();
        headers.append('Content-Type', 'application/json');
        return this.http.post(SCAService.PATH + '/resource/installsshkey', JSON.stringify({
            username: username,
            password: password,
            pubkey: pubkey,
            comment: comment,
            host: "karst.uits.iu.edu"
        }), { headers: headers })
            .map(function (response) { return response.json(); });
    };
    SCAService.homedir = function () {
        return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
    };
    SCAService.PATH = "https://soichi7.ppa.iu.edu/api/sca"; //TODO point this to production
    SCAService = __decorate([
        core_1.Injectable(), 
        __metadata('design:paramtypes', [http_1.Http])
    ], SCAService);
    return SCAService;
}());
exports.SCAService = SCAService;
//# sourceMappingURL=sca.service.js.map