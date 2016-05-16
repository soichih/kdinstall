import { Component, NgZone, Directive, Input, Inject, ViewChild } from '@angular/core';
import { NgForm } from '@angular/common';
import { PROGRESSBAR_DIRECTIVES } from 'ng2-bootstrap';
import {ToasterContainerComponent, ToasterService} from 'angular2-toaster/angular2-toaster';
//import { FontAwesomeDirective } from 'ng2-fontawesome';
import { SSHKeyComponent } from './sshkey.component'
import { Broadcaster } from './sca.service';

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
const spawn = nodeRequire('child_process').spawn;
const ipcRenderer = nodeRequire('electron').ipcRenderer;    

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
    SSHKeyComponent,
  ],
  viewProviders: [Broadcaster],
  providers: [ToasterService], 
})
export class AppComponent { 
    
    state: string = "start";
    
    //start
    submitted: boolean = false;
    form = {
        username: "",
        password: "", 
    };
    
    //download / install thinlinc
    downloaded: boolean = false;
    download_error: string = "";
    download_progress: number = 0;
    download_path: string = null;
    installer_name: string = null;
    install_cmd: string = null;
    
    //sshkey
    installed: boolean = false;
    install_error: string = "";
    
    //thinlinc
    configured: boolean = false;
    configure_error: string = "";
    logo_path: string = null; //location for custom thinlinc branding
    tlclient: string = "/opt/thinlinc/bin/tlclient";
    
    @ViewChild('focus') focus_elem;
        
    constructor(
      private toasterService: ToasterService, 
      private _ngZone: NgZone, 
      private broadcaster: Broadcaster) {
        
      this.toasterService = toasterService;
      
      //let's just support x64 for now..
      if(os.arch() != "x64") {
        this.toasterService.pop('error', 'Unsupported Architecture', os.arch());
        this.state = 'failed';
        return;
      }

      //determine which installer to use
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
                this.installer_name = "thinlinc-client_4.5.0-4930_amd64.deb";  
                this.install_cmd = "dpkg -i";
                this.download_path = os.tmpdir()+'/'+this.installer_name;
              }
            });
          } else {
            this.installer_name = "thinlinc-client-4.5.0-4930.x86_64.rpm";
            this.install_cmd = "rpm --reinstall";
            this.download_path = os.tmpdir()+'/'+this.installer_name;
          }
        });
        this.logo_path = "/opt/thinlinc/lib/tlclient/branding.png";
        break;
      case "win32":
        this.installer_name = "tl-4.5.0-client-windows.exe";
        this.install_cmd = "";
        this.download_path = os.tmpdir()+'/'+this.installer_name;
        this.logo_path = "c:/branding.png"; //TODO..

        //TODO - I need to get this info from installer, or somehow find where tlclient.exe is installed.. 
        this.tlclient = "C:\\Program Files (x86)\\ThinLinc Client\\tlclient.exe"; 

        break;
      case "darwin":
        this.installer_name = "tl-4.5.0_4930-client-osx.iso";
        this.install_cmd = "todo";
        this.download_path = os.tmpdir()+'/'+this.installer_name;
        this.logo_path = "/Applications/Thinlinc Client/Contents/lib/tlclient/branding.png";
        break;
      default:
        this.toasterService.pop('error', 'Unsupported Platform', os.platform());
        this.state = 'failed';
        return;
      }
      
      //console.log("logo_path:"+this.logo_path);
      this.broadcaster.on('done_sshkey', (e)=>{ 
        console.log("done installing sshkey");
        this.configure(e);
      });
      this.broadcaster.on('failed', ()=>this.state = 'failed');
      
      setTimeout(()=>{
        this.focus_elem.nativeElement.focus();
      }, 1000);
    }
    
    stop() {
      //TODO - depending on the state, do some cleanup
      this.state = "start";
      this.download_progress = 0;
    }
    
    retry() {
      this.state = "start";
      this.submitted = false;
      this.download_error = "";
      this.install_error = "";
      this.configure_error = "";
    }
    
    submit() {
      this.submitted = true;
      this.download();
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
          request_progress(request('https://www.cendio.com/downloads/clients/'+this.installer_name), {
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
          name: 'ThinLink Client Installer',
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
        sudo.exec(this.install_cmd+' '+this.download_path, options, (err, data) => {
          console.log(data); //message from installer... should I display?
          this._ngZone.run(() => {
            if(err) {
              this.install_error = err;
              this.state = 'failed';
            } else {
              this.installed = true;
              this.state = "sshkey";
              this.broadcaster.emit('run_sshkey');
            }
          });
        });       
    }
    
    configure(e) {
      async.series([
        (next) => thinlinc.setConfig("AUTHENTICATION_METHOD", "publickey", next),
        (next) => thinlinc.setConfig("LOGIN_NAME", this.form.username, next),
        (next) => thinlinc.setConfig("PRIVATE_KEY", e.private_key_path, next),
        (next) => thinlinc.setConfig("SERVER_NAME", "desktop.karst.uits.iu.edu", next),
        
        //recommended in KB.
        (next) => thinlinc.setConfig("FULL_SCREEN_ALL_MONITORS", "0", next),     
        (next) => thinlinc.setConfig("FULL_SCREEN_MODE", "0", next),    

        (next) => thinlinc.setConfig("REMOTE_RESIZE", "0", next),  
        
        //I think this breaks the windows thinlinc?  
        //(next) => thinlinc.setConfig("SCREEN_SIZE_SELECTION", "5", next),     
              
        /*  
        (next) => {
          console.log("installing branding logo");
          sudo.exec('cp images/branding.png '+this.logo_path, {
            name: 'ThinLink Client Installer',
            process: {
              options: {},
              on: function(ps) {
                ps.stdout.on('data', function(data) {
                  console.log(data.toString());
                });
                ps.stderr.on('data', function(data) {
                  console.error(data.toString());
                });
              }
            }           
          }, next);
        }  
        */        
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
      spawn(this.tlclient, {detached: true});
      
      ipcRenderer.send('quit');
      /*
      //not sure if I really need timeout.. but just to be safe
      setTimeout(()=>{
          ipcRenderer.send('quit');
      }, 1);
      */
    }
}