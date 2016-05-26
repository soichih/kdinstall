import { Component, NgZone, Directive, Input, Inject, ViewChild } from '@angular/core';
import { NgForm } from '@angular/common';
import { PROGRESSBAR_DIRECTIVES } from 'ng2-bootstrap';
import {ToasterContainerComponent, ToasterService} from 'angular2-toaster/angular2-toaster';
//import { FontAwesomeDirective } from 'ng2-fontawesome';
//import { SSHKeyComponent } from './sshkey.component'
import { Broadcaster, SCAService } from './sca.service';

declare function nodeRequire(name: string);

//import fs from '@node/fs';
const fs = nodeRequire("fs");
const async = nodeRequire("async");
const request = nodeRequire('request');
const request_progress = nodeRequire('request-progress');
const sudo = nodeRequire('electron-sudo');
const os = nodeRequire('os');
const whereis = nodeRequire('whereis');
const thinlinc = nodeRequire('thinlinc');
const child_process = nodeRequire('child_process');
const ipcRenderer = nodeRequire('electron').ipcRenderer;    
const _path = nodeRequire('path');

@Component({
  selector: 'kdinstall',
  styles: [`
    .something {
      color: red;
    }
  `],
  templateUrl: 'app/app.html',
  directives: [
    PROGRESSBAR_DIRECTIVES, 
    ToasterContainerComponent,
    //SSHKeyComponent,
  ],
  viewProviders: [Broadcaster],
  providers: [ToasterService, SCAService], 
})
export class AppComponent { 
    
    state: string = "start";
    
    //start
    submitted: boolean = false;
    form = {
        username: "",
        password: "", 
    };
    
    //genssh
    private gensshed: boolean = false;
    private genssh_error: string = "";
    private genssh_status: string = "Initializing ...";
    private id = "sca."+Date.now();
    private private_key_path = _path.join(SCAService.homedir(), '.ssh', this.id+'.id_rsa');
    private public_key_path = _path.join(SCAService.homedir(), '.ssh', this.id+'.id_rsa.pub');
    private key: string = null;
    private pubkey: string = null;
    
    //download / install thinlinc
    private downloaded: boolean = false;
    private download_error: string = "";
    private download_progress: number = 0;
    private download_path: string = null;
    private installer_name: string = null;
    private install_cmd: string = null;
    
    //sshkey
    private installed: boolean = false;
    private install_error: string = "";
    
    //thinlinc
    private configured: boolean = false;
    private configure_error: string = "";
    private logo_path: string = null; //location for custom thinlinc branding
    private tlclient_path: string = null; //location where tlclient executable will be installed
    
    //used to focus the user name field
    @ViewChild('focus') focus_elem;
        
    constructor(
      private toasterService: ToasterService, 
      private _ngZone: NgZone, 
      private sca: SCAService,
      private broadcaster: Broadcaster) {

      //this temporarly patches the issue of "EPERM: operation not permitted, write" happens at sudo.exec()
      process.stderr.write = console.error.bind(console); 
      process.stdout.write = console.log.bind(console);        
      /*

      console.dir(process.stderr);
      process.stderr.write("this should cause exception");
      */
      
      //let's just support x64 for now..
      if(os.arch() != "x64") {
        this.toasterService.pop('error', 'Unsupported Architecture', os.arch());
        this.state = 'failed';
        return;
      }

      //set various os specific configurations
      switch(os.platform()) {
      case "linux":
        //determine yum or dpkg to use..
        whereis('yum', (err, path)=> {
          if(err) {
            whereis('dpkg', (err, path)=> {
              if(err) {
                this.toasterService.pop('error', 'Unsupported package manager', "Couldn't find yum nor dpkg");
                this.state = 'failed';
              } else {
                //this._ngZone.run(() => {
                //}); //this is the new apply?
                this.installer_name = "linux-amd64.deb";  
                this.download_path = os.tmpdir()+'/'+this.installer_name;
                this.install_cmd = "dpkg -i "+this.download_path;
              }
            });
          } else {
            this.installer_name = "linux-x86_64.rpm";
            this.download_path = os.tmpdir()+'/'+this.installer_name;
            this.install_cmd = "rpm --reinstall "+this.download_path;
          }
        });
        this.logo_path = "/opt/thinlinc/lib/tlclient/branding.png";
        this.tlclient_path = "/opt/thinlinc/bin/tlclient";
        
        //console.log(_path.resolve(_path.dirname(process.execPath), ".."));
        break;
      case "win32":
        this.installer_name = "windows.zip";
        this.download_path = os.tmpdir()+'/'+this.installer_name;
        var programfiles_dir = child_process.execSync("echo %programfiles%", {encoding: 'utf8'}).trim();
        var install_dir = programfiles_dir+"\\ThinLinc";
        
        console.log("powershell.exe -nologo -noprofile -command \"& { Add-Type -A 'System.IO.Compression.FileSystem'; [IO.Compression.ZipFile]::ExtractToDirectory('"+this.download_path+"', '"+install_dir+"'); }\"");
        this.install_cmd = "powershell.exe -nologo -noprofile -command \"& { Add-Type -A 'System.IO.Compression.FileSystem'; [IO.Compression.ZipFile]::ExtractToDirectory('"+this.download_path+"', '"+install_dir+"'); }\"";

        //TODO - not sure where this go yet..
        this.logo_path = install_dir+"\\branding.png"; 
        
        //TODO - I need to get this info from installer, or somehow find where tlclient.exe is installed.. 
        this.tlclient_path = install_dir+"\\tlclient.exe"; 
        break;
      case "darwin":
        this.installer_name = "osx.tar.gz";
        this.download_path = os.tmpdir()+'/'+this.installer_name;
        this.install_cmd = "tar -xzf "+this.download_path+" -C /Applications";
        this.logo_path = "/Applications/ThinLinc Client/Contents/lib/tlclient/branding.png";
        this.tlclient_path = "/Applications/ThinLinc Client/Contents/MacOS/tlclient";        
        break;
      default:
        this.toasterService.pop('error', 'Unsupported Platform', os.platform());
        this.state = 'failed';
        return;
      }
           
      setTimeout(()=>{
        this.focus_elem.nativeElement.focus();
      }, 0);
    }
    
    stop() {
      //TODO - depending on the state, do some cleanup
      this.state = "start";
      this.download_progress = 0;
    }
    
    retry() {
      this.state = "start";
      this.form.password = "";
      this.submitted = false;
      this.genssh_error = "";
      this.download_error = "";
      this.install_error = "";
      this.configure_error = "";
    }
    
    submit() {
      this.submitted = true;
      this.genssh();
    }
    
    genssh() {
      this.state = "genssh";
      console.log("running sshkey installer");
      async.series([
          (next)=>this.mkdir_ssh(next), 
          (next)=>this.request_sshkeys(next),
          (next)=>this.store_local_sshkeys(next),
          (next)=>this.store_remote_sshkeys(next),
      ], (err) => {
          if(err) {
              this.genssh_error = err;
              this.state = 'failed';
              return;
          }
          this._ngZone.run(() => {
              this.gensshed = true;
              this.download();
          });
      });     
    }
    
    mkdir_ssh(next) {
        this._ngZone.run(() => {
            this.genssh_status = "Making sure ~/.ssh exists";
         });    
        fs.mkdir(SCAService.homedir()+'/.ssh',function(err) {
            if(!err || (err && err.code === 'EEXIST')){
                next();
            } else next(err);
        });    
    }
    
    request_sshkeys(next) { 
        this._ngZone.run(() => {
            this.genssh_status = "Generating SSH keys";
        });
        this.sca.generateSSHKeys()
        .subscribe(
            data => {
                this.key = data.key;
                this.pubkey = data.pubkey;
                next();
            },
            err => {
                console.dir(err);
                this._ngZone.run(() => {
                    try {
                        var body = JSON.parse(err._body);
                        this.genssh_error = body.message;
                    } catch (ex) {
                       this.genssh_error = "Failed to Generate SSH Key.";       
                    }                          
                    this.state = "failed"; //doesn't update appcomponent state (no 2-way binding?)
                });
            }
        );
    }
    
    store_local_sshkeys(next) { 
        this._ngZone.run(() => {
            this.genssh_status = "Storing SSH keys";
        });
        fs.writeFile(this.private_key_path, this.key, (err)=> {
            if(err) return next(err);
            fs.chmod(this.private_key_path, '600', (err)=> {
                if(err) return next(err);
                fs.writeFile(this.public_key_path, this.pubkey, next);
            });
        });
    }
    
    store_remote_sshkeys(next) {
        this._ngZone.run(() => {
            this.genssh_status = "Storing SSH on Karst";
        });
        this.sca.storeSSHKey(this.form.username, this.form.password, this.pubkey, 
            "SSH Key for Karst Desktop Access: sca."+this.id)
        .subscribe(
            data => {
                //console.dir(data);
                next();
            },
            err => {
                console.dir(err);
                this._ngZone.run(() => {
                    try {
                        var body = JSON.parse(err._body);
                        //this.toasterService.pop('error', "Failed to store SSH key", body.message);
                        this.genssh_error = body.message;
                    } catch (ex) {
                       this.genssh_error = "Failed to install SSH Key.";       
                    }               
                    this.state = "failed"; //doesn't update appcomponent state (no 2-way binding?)
                    //this.broadcaster.emit('failed');
                });
            }
        );
    }
    
    download() {
      this.state = "download";
      //this.toasterService.pop('success', 'Args Title', 'Args Body'); 
      
      //TODO - handle case: can't write
      //TODO - test if it failes to download
      fs.stat(this.download_path, (err, stats) => {
        if(!err && stats) {
          console.log(this.download_path+ " already exist.. skipping");
            this._ngZone.run(() => {
              this.downloaded = true;
              this.install();
            });
        } else {
          request_progress(request('https://dl.dropboxusercontent.com/u/3209692/thinlinc/'+this.installer_name), {
            throttle: 200,
            //delay: 1000
          })
          .on('progress', (state) => {
            this._ngZone.run(() => {
              this.download_progress = state.percentage * 100;
            }); //this is the new apply?
          })
          .on('error', (err) => {
            //this.toasterService.pop('error', 'Download Failed', err);
            this._ngZone.run(() => {
              this.download_error = err;
              this.state = 'failed';
            });
          })
          .on('end', (err) => {   
            if(err) return console.error(err);
            this._ngZone.run(() => {
              this.downloaded = true;
              this.install();
            });
          })
          .pipe(fs.createWriteStream(this.download_path));          
        }
      });
    }
    
    install() {
        this.state = "install";
        var options = {
          name: 'Installing ThinLinc Client',
          process: {
            options: {},
            on: function(ps) {
              ps.stdout.on('data', function(data) {
                console.log(data.toString());
              });
              ps.stderr.on('data', function(data) {
                console.log("error received");
                console.error(data.toString());
              });
            }
          }
        };
        
        //run the installer as root
        sudo.exec(this.install_cmd, options, (err, data) => {
          console.log(data); //message from installer... should I display?
          this._ngZone.run(() => {
            if(err) {
              this.install_error = err;
              this.state = 'failed';
            } else {
              this.installed = true;
              this.configure();
              //this.broadcaster.emit('run_sshkey');
            }
          });
        });       
    }
    
    configure() {
      this.state = "configure";
      async.series([
        (next) => thinlinc.setConfig("AUTHENTICATION_METHOD", "publickey", next),
        (next) => thinlinc.setConfig("LOGIN_NAME", this.form.username, next),
        (next) => thinlinc.setConfig("PRIVATE_KEY", this.private_key_path, next),
        (next) => thinlinc.setConfig("SERVER_NAME", "desktop.karst.uits.iu.edu", next),
        
        //recommended in KB.
        (next) => thinlinc.setConfig("FULL_SCREEN_ALL_MONITORS", 0, next),     
        (next) => thinlinc.setConfig("FULL_SCREEN_MODE", 0, next),    

        //needed to get rid of scrollbar inside the client window
        (next) => thinlinc.setConfig("REMOTE_RESIZE", 1, next),  

      ], (err)=> {
        this._ngZone.run(() => {
          if(err) {
            this.configure_error = err;
            this.state = 'failed';
          } else {
            this.configured = true;
            this.state = "finished";
          }
        });
      });
    }
    
    close() {
      console.log("close");
      ipcRenderer.send('quit');
    }
    
    launch_tl() {
      //alert("launching:"+this.tlclient_path);
      child_process.spawn(this.tlclient_path, {detached: true});
      ipcRenderer.send('quit');
    }
}
