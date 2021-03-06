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
//import { SSHKeyComponent } from './sshkey.component'
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
var child_process = nodeRequire('child_process');
var ipcRenderer = nodeRequire('electron').ipcRenderer;
var _path = nodeRequire('path');
var AppComponent = (function () {
    function AppComponent(toasterService, _ngZone, sca, broadcaster) {
        var _this = this;
        this.toasterService = toasterService;
        this._ngZone = _ngZone;
        this.sca = sca;
        this.broadcaster = broadcaster;
        this.state = "start";
        //start
        this.submitted = false;
        this.form = {
            username: "",
            password: "",
        };
        //genssh
        this.gensshed = false;
        this.genssh_error = "";
        this.genssh_status = "Initializing ...";
        this.id = "sca." + Date.now();
        this.private_key_path = _path.join(sca_service_1.SCAService.homedir(), '.ssh', this.id + '.id_rsa');
        this.public_key_path = _path.join(sca_service_1.SCAService.homedir(), '.ssh', this.id + '.id_rsa.pub');
        this.key = null;
        this.pubkey = null;
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
        this.tlclient_path = null; //location where tlclient executable will be installed
        //this temporarly patches the issue of "EPERM: operation not permitted, write" happens at sudo.exec()
        process.stderr.write = console.error.bind(console);
        process.stdout.write = console.log.bind(console);
        /*
  
        console.dir(process.stderr);
        process.stderr.write("this should cause exception");
        */
        //let's just support x64 for now..
        if (os.arch() != "x64") {
            this.toasterService.pop('error', 'Unsupported Architecture', os.arch());
            this.state = 'failed';
            return;
        }
        //set various os specific configurations
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
                                _this.installer_name = "linux-amd64.deb";
                                _this.download_path = os.tmpdir() + '/' + _this.installer_name;
                                _this.install_cmd = "dpkg -i " + _this.download_path;
                            }
                        });
                    }
                    else {
                        _this.installer_name = "linux-x86_64.rpm";
                        _this.download_path = os.tmpdir() + '/' + _this.installer_name;
                        _this.install_cmd = "rpm --reinstall " + _this.download_path;
                    }
                });
                this.logo_path = "/opt/thinlinc/lib/tlclient/branding.png";
                this.tlclient_path = "/opt/thinlinc/bin/tlclient";
                //console.log(_path.resolve(_path.dirname(process.execPath), ".."));
                break;
            case "win32":
                this.installer_name = "windows.zip";
                this.download_path = os.tmpdir() + '/' + this.installer_name;
                var programfiles_dir = child_process.execSync("echo %programfiles%", { encoding: 'utf8' }).trim();
                var install_dir = programfiles_dir + "\\ThinLinc";
                console.log("powershell.exe -nologo -noprofile -command \"& { Add-Type -A 'System.IO.Compression.FileSystem'; [IO.Compression.ZipFile]::ExtractToDirectory('" + this.download_path + "', '" + install_dir + "'); }\"");
                this.install_cmd = "powershell.exe -nologo -noprofile -command \"& { Add-Type -A 'System.IO.Compression.FileSystem'; [IO.Compression.ZipFile]::ExtractToDirectory('" + this.download_path + "', '" + install_dir + "'); }\"";
                //TODO - not sure where this go yet..
                this.logo_path = install_dir + "\\branding.png";
                //TODO - I need to get this info from installer, or somehow find where tlclient.exe is installed.. 
                this.tlclient_path = install_dir + "\\tlclient.exe";
                break;
            case "darwin":
                this.installer_name = "osx.tar.gz";
                this.download_path = os.tmpdir() + '/' + this.installer_name;
                this.install_cmd = "tar -xzf " + this.download_path + " -C /Applications";
                this.logo_path = "/Applications/ThinLinc Client/Contents/lib/tlclient/branding.png";
                this.tlclient_path = "/Applications/ThinLinc Client/Contents/MacOS/tlclient";
                break;
            default:
                this.toasterService.pop('error', 'Unsupported Platform', os.platform());
                this.state = 'failed';
                return;
        }
        setTimeout(function () {
            _this.focus_elem.nativeElement.focus();
        }, 0);
    }
    AppComponent.prototype.stop = function () {
        //TODO - depending on the state, do some cleanup
        this.state = "start";
        this.download_progress = 0;
    };
    AppComponent.prototype.retry = function () {
        this.state = "start";
        this.submitted = false;
        this.genssh_error = "";
        this.download_error = "";
        this.install_error = "";
        this.configure_error = "";
    };
    AppComponent.prototype.submit = function () {
        this.submitted = true;
        this.genssh();
    };
    AppComponent.prototype.genssh = function () {
        var _this = this;
        this.state = "genssh";
        console.log("running sshkey installer");
        async.series([
            function (next) { return _this.mkdir_ssh(next); },
            function (next) { return _this.request_sshkeys(next); },
            function (next) { return _this.store_local_sshkeys(next); },
            function (next) { return _this.store_remote_sshkeys(next); },
        ], function (err) {
            if (err) {
                _this.genssh_error = err;
                _this.state = 'failed';
                return;
            }
            _this._ngZone.run(function () {
                _this.gensshed = true;
                _this.download();
            });
        });
    };
    AppComponent.prototype.mkdir_ssh = function (next) {
        var _this = this;
        this._ngZone.run(function () {
            _this.genssh_status = "Making sure ~/.ssh exists";
        });
        fs.mkdir(sca_service_1.SCAService.homedir() + '/.ssh', function (err) {
            if (!err || (err && err.code === 'EEXIST')) {
                next();
            }
            else
                next(err);
        });
    };
    AppComponent.prototype.request_sshkeys = function (next) {
        var _this = this;
        this._ngZone.run(function () {
            _this.genssh_status = "Generating SSH keys";
        });
        this.sca.generateSSHKeys()
            .subscribe(function (data) {
            _this.key = data.key;
            _this.pubkey = data.pubkey;
            next();
        }, function (err) {
            console.dir(err);
            _this._ngZone.run(function () {
                try {
                    var body = JSON.parse(err._body);
                    _this.genssh_error = body.message;
                }
                catch (ex) {
                    _this.genssh_error = "Failed to Generate SSH Key.";
                }
                _this.state = "failed"; //doesn't update appcomponent state (no 2-way binding?)
            });
        });
    };
    AppComponent.prototype.store_local_sshkeys = function (next) {
        var _this = this;
        this._ngZone.run(function () {
            _this.genssh_status = "Storing SSH keys";
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
    AppComponent.prototype.store_remote_sshkeys = function (next) {
        var _this = this;
        this._ngZone.run(function () {
            _this.genssh_status = "Storing SSH on Karst";
        });
        this.sca.storeSSHKey(this.form.username, this.form.password, this.pubkey, "SSH Key for Karst Desktop Access: sca." + this.id)
            .subscribe(function (data) {
            //console.dir(data);
            next();
        }, function (err) {
            console.dir(err);
            _this._ngZone.run(function () {
                try {
                    var body = JSON.parse(err._body);
                    //this.toasterService.pop('error', "Failed to store SSH key", body.message);
                    _this.genssh_error = body.message;
                }
                catch (ex) {
                    _this.genssh_error = "Failed to install SSH Key.";
                }
                _this.state = "failed"; //doesn't update appcomponent state (no 2-way binding?)
                //this.broadcaster.emit('failed');
            });
        });
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
                request_progress(request('https://dl.dropboxusercontent.com/u/3209692/thinlinc/' + _this.installer_name), {
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
            name: 'Installing ThinLinc Client',
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
        sudo.exec(this.install_cmd, options, function (err, data) {
            console.log(data); //message from installer... should I display?
            _this._ngZone.run(function () {
                if (err) {
                    _this.install_error = err;
                    _this.state = 'failed';
                }
                else {
                    _this.installed = true;
                    _this.configure();
                }
            });
        });
    };
    AppComponent.prototype.configure = function () {
        var _this = this;
        this.state = "configure";
        async.series([
            function (next) { return thinlinc.setConfig("AUTHENTICATION_METHOD", "publickey", next); },
            function (next) { return thinlinc.setConfig("LOGIN_NAME", _this.form.username, next); },
            function (next) { return thinlinc.setConfig("PRIVATE_KEY", _this.private_key_path, next); },
            function (next) { return thinlinc.setConfig("SERVER_NAME", "desktop.karst.uits.iu.edu", next); },
            //recommended in KB.
            function (next) { return thinlinc.setConfig("FULL_SCREEN_ALL_MONITORS", 0, next); },
            function (next) { return thinlinc.setConfig("FULL_SCREEN_MODE", 0, next); },
            //needed to get rid of scrollbar inside the client window
            function (next) { return thinlinc.setConfig("REMOTE_RESIZE", 1, next); },
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
        //alert("launching:"+this.tlclient_path);
        child_process.spawn(this.tlclient_path, { detached: true });
        ipcRenderer.send('quit');
    };
    __decorate([
        //location where tlclient executable will be installed
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
            ],
            viewProviders: [sca_service_1.Broadcaster],
            providers: [angular2_toaster_1.ToasterService, sca_service_1.SCAService],
        }), 
        __metadata('design:paramtypes', [angular2_toaster_1.ToasterService, core_1.NgZone, sca_service_1.SCAService, sca_service_1.Broadcaster])
    ], AppComponent);
    return AppComponent;
}());
exports.AppComponent = AppComponent;
//# sourceMappingURL=app.component.js.map