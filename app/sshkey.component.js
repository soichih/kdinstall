"use strict";
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
var angular2_toaster_1 = require('angular2-toaster/angular2-toaster');
//import { HTTP_PROVIDERS }    from '@angular/http';
var sca_service_1 = require('./sca.service');
//contrib
//const ursa = nodeRequire('ursa-purejs');                      
//const NodeRSA = nodeRequire('node-rsa');
var fs = nodeRequire("fs");
var _path = nodeRequire('path');
var async = nodeRequire('async');
var SSHKeyComponent = (function () {
    function SSHKeyComponent(toasterService, _ngZone, sca, broadcaster) {
        var _this = this;
        this.toasterService = toasterService;
        this._ngZone = _ngZone;
        this.sca = sca;
        this.broadcaster = broadcaster;
        this.id = "sca." + Date.now();
        this.private_key_path = _path.join(sca_service_1.SCAService.homedir(), '.ssh', this.id + '.id_rsa');
        this.public_key_path = _path.join(sca_service_1.SCAService.homedir(), '.ssh', this.id + '.id_rsa.pub');
        this.installed = false;
        this.sshkey_error = "";
        this.status = "";
        this.key = null;
        this.pubkey = null;
        //console.log("ctor sshkey");
        this.toasterService = toasterService;
        this._ngZone = _ngZone;
        this.sca = sca;
        this.broadcaster.on('run_sshkey', function () { return _this.run(); });
    }
    SSHKeyComponent.prototype.run = function () {
        var _this = this;
        console.log("running sshkey installer");
        async.series([
            function (next) { return _this.mkdir_ssh(next); },
            function (next) { return _this.request_sshkeys(next); },
            function (next) { return _this.store_local_sshkeys(next); },
            function (next) { return _this.store_remote_sshkeys(next); },
        ], function (err) {
            if (err) {
                _this.status = err;
                _this.state = 'failed';
                return;
            }
            _this._ngZone.run(function () {
                _this.installed = true;
                _this.state = "configure";
                _this.broadcaster.emit('done_sshkey', {
                    //username: this.model.username,
                    private_key_path: _this.private_key_path,
                });
            });
        });
    };
    SSHKeyComponent.prototype.mkdir_ssh = function (next) {
        var _this = this;
        this._ngZone.run(function () {
            _this.status = "Making sure ~/.ssh exists";
        });
        fs.mkdir(sca_service_1.SCAService.homedir() + '/.ssh', function (err) {
            if (!err || (err && err.code === 'EEXIST')) {
                next();
            }
            else
                next(err);
        });
    };
    SSHKeyComponent.prototype.request_sshkeys = function (next) {
        var _this = this;
        this._ngZone.run(function () {
            _this.status = "Generating SSH keys";
        });
        this.sca.generateSSHKeys()
            .subscribe(function (data) {
            _this.key = data.key;
            _this.pubkey = data.pubkey;
            next();
        }, function (err) {
            console.dir(err);
            _this._ngZone.run(function () {
                // this.toasterService.pop('error', err)
                //var body = JSON.parse(err._body);
                try {
                    var body = JSON.parse(err._body);
                    //this.toasterService.pop('error', "Failed to store SSH key", body.message);
                    _this.sshkey_error = body.message;
                }
                catch (ex) {
                    _this.sshkey_error = "Failed to Generate SSH Key.";
                }
                _this.state = "failed"; //doesn't update appcomponent state (no 2-way binding?)
                _this.broadcaster.emit('failed');
            });
        });
    };
    SSHKeyComponent.prototype.store_local_sshkeys = function (next) {
        var _this = this;
        this._ngZone.run(function () {
            _this.status = "Storing SSH keys";
        });
        fs.writeFile(this.private_key_path, this.key, function (err) {
            if (err)
                return next(err);
            fs.chmod(_this.private_key_path, '600', function (err) {
                if (err)
                    return next(err);
                fs.writeFile(_this.public_key_path, _this.pubkey, next);
            });
        });
    };
    SSHKeyComponent.prototype.store_remote_sshkeys = function (next) {
        var _this = this;
        this._ngZone.run(function () {
            _this.status = "Storing SSH on Karst";
        });
        this.sca.storeSSHKey(this.form.username, this.form.password, this.pubkey, "SSH Key for Karst Desktop Access: sca." + this.id)
            .subscribe(function (data) {
            console.dir(data);
            next();
        }, function (err) {
            console.dir(err);
            _this._ngZone.run(function () {
                try {
                    var body = JSON.parse(err._body);
                    //this.toasterService.pop('error', "Failed to store SSH key", body.message);
                    _this.sshkey_error = body.message;
                }
                catch (ex) {
                    _this.sshkey_error = "Failed to install SSH Key.";
                }
                _this.state = "failed"; //doesn't update appcomponent state (no 2-way binding?)
                _this.broadcaster.emit('failed');
            });
        });
    };
    __decorate([
        core_1.Input(), 
        __metadata('design:type', String)
    ], SSHKeyComponent.prototype, "state", void 0);
    __decorate([
        core_1.Input(), 
        __metadata('design:type', Object)
    ], SSHKeyComponent.prototype, "form", void 0);
    SSHKeyComponent = __decorate([
        core_1.Component({
            selector: 'sshkey',
            templateUrl: 'app/sshkey.html',
            providers: [sca_service_1.SCAService],
        }), 
        __metadata('design:paramtypes', [angular2_toaster_1.ToasterService, core_1.NgZone, sca_service_1.SCAService, sca_service_1.Broadcaster])
    ], SSHKeyComponent);
    return SSHKeyComponent;
}());
exports.SSHKeyComponent = SSHKeyComponent;
//# sourceMappingURL=sshkey.component.js.map