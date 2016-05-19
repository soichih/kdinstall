
import { enableProdMode } from '@angular/core';  
import { bootstrap }    from '@angular/platform-browser-dynamic';
import { HTTP_PROVIDERS } from '@angular/http'; //used by SCAService
import { AppComponent } from './app.component';

enableProdMode(); 
bootstrap(AppComponent,  [HTTP_PROVIDERS]);