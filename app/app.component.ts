import { Component } from '@angular/core';

//import fs from '@node/fs';
var fs = nodeRequire("fs");
var async = nodeRequire("async");

@Component({
  selector: 'my-app',
  template: `<h1>My First Angular 2 App</h1>
  <ul>
    <li *ngFor="let name of names">{{name}}</li>
  </ul>
  `
})
export class AppComponent { 
    names: string[] = [];  
    
    constructor() {
      fs.readFile("package.json", (err, data)=> {
        console.dir(data.toString());
      });
      
      this.names.push("sage");
      this.names.push("soichi");
      this.names.push("mae");
      
      async.series([
        (next)=>{
          this.names.push("async.1");
          next();
        },
        (next)=>{
          this.names.push("async.2");
          next();
        },
        (next)=>{
          this.names.push("async.3");
          next();
        },
      ]);
      
    }
}