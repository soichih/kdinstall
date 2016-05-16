import { Component, Input, Injectable, NgZone } from '@angular/core';
import { ToasterService } from 'angular2-toaster/angular2-toaster';
//import { HTTP_PROVIDERS }    from '@angular/http';
import { SCAService, Broadcaster } from './sca.service';

declare function nodeRequire(name: string);

//contrib
//const ursa = nodeRequire('ursa-purejs');                      
//const NodeRSA = nodeRequire('node-rsa');
const fs = nodeRequire("fs");
const _path = nodeRequire('path');
const async = nodeRequire('async');

@Component({
  selector: 'sshkey',
  templateUrl: 'app/sshkey.html',
  providers: [SCAService], 
})
export class SSHKeyComponent {   
    @Input() state: string;
    @Input() form; //username / password
       
    private id = "sca."+Date.now();
    private private_key_path = _path.join(SCAService.homedir(), '.ssh', this.id+'.id_rsa');
    private public_key_path = _path.join(SCAService.homedir(), '.ssh', this.id+'.id_rsa.pub');
    
    installed = false;
    status: string = "";
    
    private key: string = null;
    private pubkey: string = null;
       
    constructor (
        private toasterService: ToasterService, 
        private _ngZone: NgZone, 
        private sca: SCAService,
        private broadcaster: Broadcaster
    ) {
        console.log("ctor sshkey");
        this.toasterService = toasterService;
        this._ngZone = _ngZone;
        this.sca = sca;
        this.broadcaster.on('run_sshkey', ()=>this.run());
    }
    
    run() { 
        console.log("running sshkey installer");
        async.series([
            (next)=>this.mkdir_ssh(next), 
            (next)=>this.request_sshkeys(next),
            (next)=>this.store_local_sshkeys(next),
            (next)=>this.store_remote_sshkeys(next),
        ], (err) => {
            if(err) return this.status = err;
            this._ngZone.run(() => {
                this.installed = true;
                this.state = "thinlinc";
                this.broadcaster.emit('done_sshkey', {
                    //username: this.model.username,
                    private_key_path: this.private_key_path,
                });
            });
        });
    }
        
    mkdir_ssh(next) {
        this._ngZone.run(() => {
            this.status = "Making sure ~/.ssh exists";
         });    
        fs.mkdir(SCAService.homedir()+'/.ssh',function(err) {
            if(!err || (err && err.code === 'EEXIST')){
                next();
            } else next(err);
        });    
    }
    
    request_sshkeys(next) { 
        this._ngZone.run(() => {
            this.status = "Generating SSH keys";
        });
        this.sca.generateSSHKeys()
        .subscribe(
            data => {
                this.key = data.key;
                this.pubkey = data.pubkey;
                next();
            },
            err => this.toasterService.pop('error', err)
        );
    }
    
    store_local_sshkeys(next) { 
        this._ngZone.run(() => {
            this.status = "Storing SSH keys";
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
            this.status = "Storing SSH on Karst";
        });
        this.sca.storeSSHKey(this.form.username, this.form.password, this.pubkey, 
            "SSH Key for Karst Desktop Access: sca."+this.id)
        .subscribe(
            data => {
                console.dir(data);
                next();
            },
            err => {
                var body = JSON.parse(err._body);
                this.toasterService.pop('error', "Failed to store SSH key", body.message);
                console.dir(err);
            }
        );
    }
}
