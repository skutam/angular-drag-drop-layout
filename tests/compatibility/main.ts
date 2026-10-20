import {provideZoneChangeDetection, provideZonelessChangeDetection} from '@angular/core';
import {bootstrapApplication} from '@angular/platform-browser';
import {CompatibilityApp} from './app';

async function start(): Promise<void> {
  const zone = new URLSearchParams(location.search).get('mode') === 'zone';
  if (zone) await import('zone.js');
  await bootstrapApplication(CompatibilityApp, {
    providers: [zone ? provideZoneChangeDetection() : provideZonelessChangeDetection()],
  });
}

void start();
