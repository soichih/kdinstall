import { Component, Input, Injectable, NgZone } from '@angular/core';
import { NgForm }    from '@angular/common';
import { ToasterService } from 'angular2-toaster/angular2-toaster';
import { Http, Response, Headers } from '@angular/http';
import { Observable }     from 'rxjs/Observable';
import 'rxjs/Rx';

declare function nodeRequire(name: string);

const EventEmitter = nodeRequire('events');

export class Broadcaster extends EventEmitter {}

@Injectable()
export class SCAService {
    public http:Http;
    public static PATH:string = "https://soichi7.ppa.iu.edu/api/sca"; //TODO point this to production
    
    constructor(http:Http) {
        this.http=http;
    }
    
    generateSSHKeys() {
        return this.http.get(SCAService.PATH + '/resource/gensshkey')
        .map(res => res.json());
    }
    
    storeSSHKey(username, password, pubkey, comment) {
        var headers = new Headers();
        headers.append('Content-Type', 'application/json');
        return this.http.post(SCAService.PATH + '/resource/installsshkey', 
        JSON.stringify({
            username: username,
            password: password,
            pubkey: pubkey,
            comment: comment,
            host: "karst.uits.iu.edu"
        }), {headers: headers})
        .map(res => res.json());
    }
    
    static homedir() {
        return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
    }
}