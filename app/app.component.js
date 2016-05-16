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
var ng2_bootstrap_1 = require('ng2-bootstrap');
var angular2_toaster_1 = require('angular2-toaster/angular2-toaster');
//import { FontAwesomeDirective } from 'ng2-fontawesome';
var sshkey_component_1 = require('./sshkey.component');
var sca_service_1 = require('./sca.service');
//import fs from '@node/fs';
var fs = nodeRequire("fs");
var async = nodeRequire("async");
var request = nodeRequire('request');
var request_progress = nodeRequire('request-progress');
var sudo = nodeRequire('electron-sudo');
var os = nodeRequire('os');
var whereis = nodeRequire('whereis');
var thinlinc = nodeRequire('thinlinc');
var spawn = nodeRequire('child_process').spawn;
var ipcRenderer = nodeRequire('electron').ipcRenderer;
var AppComponent = (function () {
    function AppComponent(toasterService, _ngZone, broadcaster) {
        var _this = this;
        this.toasterService = toasterService;
        this._ngZone = _ngZone;
        this.broadcaster = broadcaster;
        this.state = "start";
        //start
        this.submitted = false;
        this.form = {
            username: "",
            password: "",
        };
        //download / install thinlinc
        this.downloaded = false;
        this.download_error = "";
        this.download_progress = 0;
        this.download_path = null;
        this.installer_name = null;
        this.install_cmd = null;
        //sshkey
        this.installed = false;
        this.install_error = "";
        //thinlinc
        this.configured = false;
        this.configure_error = "";
        this.logo_path = null; //location for custom thinlinc branding
        this.tlclient = "/opt/thinlinc/bin/tlclient";
        this.toasterService = toasterService;
        //let's just support x64 for now..
        if (os.arch() != "x64") {
            this.toasterService.pop('error', 'Unsupported Architecture', os.arch());
            this.state = 'failed';
            return;
        }
        //determine which installer to use
        switch (os.platform()) {
            case "linux":
                //determine yum or dpkg to use..
                whereis('yum', function (err, path) {
                    if (err) {
                        whereis('dpkg', function (err, path) {
                            if (err) {
                                _this.toasterService.pop('error', 'Unsupported package manager', "Couldn't find yum nor dpkg");
                                _this.state = 'failed';
                            }
                            else {
                                //this._ngZone.run(() => {
                                //}); //this is the new apply?
                                _this.installer_name = "thinlinc-client_4.5.0-4930_amd64.deb";
                                _this.install_cmd = "dpkg -i";
                                _this.download_path = os.tmpdir() + '/' + _this.installer_name;
                            }
                        });
                    }
                    else {
                        _this.installer_name = "thinlinc-client-4.5.0-4930.x86_64.rpm";
                        _this.install_cmd = "rpm --reinstall";
                        _this.download_path = os.tmpdir() + '/' + _this.installer_name;
                    }
                });
                this.logo_path = "/opt/thinlinc/lib/tlclient/branding.png";
                break;
            case "win32":
                this.installer_name = "tl-4.5.0-client-windows.exe";
                this.install_cmd = "";
                this.download_path = os.tmpdir() + '/' + this.installer_name;
                this.logo_path = "c:/branding.png"; //TODO..
                //TODO - I need to get this info from installer, or somehow find where tlclient.exe is installed.. 
                this.tlclient = "C:\\Program Files (x86)\\ThinLinc Client\\tlclient.exe";
                break;
            case "darwin":
                this.installer_name = "tl-4.5.0_4930-client-osx.iso";
                this.install_cmd = "todo";
                this.download_path = os.tmpdir() + '/' + this.installer_name;
                this.logo_path = "/Applications/Thinlinc Client/Contents/lib/tlclient/branding.png";
                break;
            default:
                this.toasterService.pop('error', 'Unsupported Platform', os.platform());
                this.state = 'failed';
                return;
        }
        //console.log("logo_path:"+this.logo_path);
        this.broadcaster.on('done_sshkey', function (e) {
            console.log("done installing sshkey");
            _this.configure(e);
        });
        this.broadcaster.on('failed', function () { return _this.state = 'failed'; });
        setTimeout(function () {
            _this.focus_elem.nativeElement.focus();
        }, 1000);
    }
    AppComponent.prototype.stop = function () {
        //TODO - depending on the state, do some cleanup
        this.state = "start";
        this.download_progress = 0;
    };
    AppComponent.prototype.retry = function () {
        this.state = "start";
        this.submitted = false;
        this.download_error = "";
        this.install_error = "";
        this.configure_error = "";
    };
    AppComponent.prototype.submit = function () {
        this.submitted = true;
        this.download();
    };
    AppComponent.prototype.download = function () {
        var _this = this;
        this.state = "download";
        //this.toasterService.pop('success', 'Args Title', 'Args Body'); 
        //TODO - handle case: can't write
        //TODO - test if it failes to download
        fs.stat(this.download_path, function (err, stats) {
            if (!err && stats) {
                console.log(_this.download_path + " already exist.. skipping");
                _this._ngZone.run(function () {
                    _this.downloaded = true;
                    _this.install();
                });
            }
            else {
                request_progress(request('https://www.cendio.com/downloads/clients/' + _this.installer_name), {
                    throttle: 200,
                })
                    .on('progress', function (state) {
                    _this._ngZone.run(function () {
                        _this.download_progress = state.percentage * 100;
                    }); //this is the new apply?
                })
                    .on('error', function (err) {
                    //this.toasterService.pop('error', 'Download Failed', err);
                    _this._ngZone.run(function () {
                        _this.download_error = err;
                        _this.state = 'failed';
                    });
                })
                    .on('end', function (err) {
                    if (err)
                        return console.error(err);
                    _this._ngZone.run(function () {
                        _this.downloaded = true;
                        _this.install();
                    });
                })
                    .pipe(fs.createWriteStream(_this.download_path));
            }
        });
    };
    AppComponent.prototype.install = function () {
        var _this = this;
        this.state = "install";
        var options = {
            name: 'ThinLink Client Installer',
            process: {
                options: {},
                on: function (ps) {
                    ps.stdout.on('data', function (data) {
                        console.log(data.toString());
                    });
                    ps.stderr.on('data', function (data) {
                        console.log("error received");
                        console.error(data.toString());
                    });
                }
            }
        };
        //run the installer as root
        sudo.exec(this.install_cmd + ' ' + this.download_path, options, function (err, data) {
            console.log(data); //message from installer... should I display?
            _this._ngZone.run(function () {
                if (err) {
                    _this.install_error = err;
                    _this.state = 'failed';
                }
                else {
                    _this.installed = true;
                    _this.state = "sshkey";
                    _this.broadcaster.emit('run_sshkey');
                }
            });
        });
    };
    AppComponent.prototype.configure = function (e) {
        var _this = this;
        async.series([
            function (next) { return thinlinc.setConfig("AUTHENTICATION_METHOD", "publickey", next); },
            function (next) { return thinlinc.setConfig("LOGIN_NAME", _this.form.username, next); },
            function (next) { return thinlinc.setConfig("PRIVATE_KEY", e.private_key_path, next); },
            function (next) { return thinlinc.setConfig("SERVER_NAME", "desktop.karst.uits.iu.edu", next); },
            //recommended in KB.
            function (next) { return thinlinc.setConfig("FULL_SCREEN_ALL_MONITORS", "0", next); },
            function (next) { return thinlinc.setConfig("FULL_SCREEN_MODE", "0", next); },
            function (next) { return thinlinc.setConfig("REMOTE_RESIZE", "0", next); },
        ], function (err) {
            _this._ngZone.run(function () {
                if (err) {
                    _this.configure_error = err;
                    _this.state = 'failed';
                }
                else {
                    _this.configured = true;
                    _this.state = "finished";
                }
            });
        });
    };
    AppComponent.prototype.close = function () {
        console.log("close");
        ipcRenderer.send('quit');
    };
    AppComponent.prototype.launch_tl = function () {
        spawn(this.tlclient, { detached: true });
        ipcRenderer.send('quit');
        /*
        //not sure if I really need timeout.. but just to be safe
        setTimeout(()=>{
            ipcRenderer.send('quit');
        }, 1);
        */
    };
    __decorate([
        core_1.ViewChild('focus'), 
        __metadata('design:type', Object)
    ], AppComponent.prototype, "focus_elem", void 0);
    AppComponent = __decorate([
        core_1.Component({
            selector: 'kdinstall',
            styles: ["\n    .something {\n      color: red;\n    }\n  "],
            templateUrl: 'app/app.html',
            directives: [
                ng2_bootstrap_1.PROGRESSBAR_DIRECTIVES,
                angular2_toaster_1.ToasterContainerComponent,
                sshkey_component_1.SSHKeyComponent,
            ],
            viewProviders: [sca_service_1.Broadcaster],
            providers: [angular2_toaster_1.ToasterService],
        }), 
        __metadata('design:paramtypes', [angular2_toaster_1.ToasterService, core_1.NgZone, sca_service_1.Broadcaster])
    ], AppComponent);
    return AppComponent;
}());
exports.AppComponent = AppComponent;
//# sourceMappingURL=app.component.js.map