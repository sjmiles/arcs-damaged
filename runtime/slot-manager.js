/**
 * @license
 * Copyright (c) 2017 Google Inc. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
"use strict";

const assert = require('assert');
const Slot = require('./slot-dom.js');

let log = !global.document || (global.logging === false) ? () => {} : (...args) => { console.log.apply(console, args); };

class SlotManager {
  constructor(domRoot, pec) {
    this._slotBySlotId = new Map();
    this._slotIdByParticleSpec = new Map();
    this._pec = pec;
    this._getOrCreateSlot('root').initialize(domRoot, /* exposedView= */ undefined);
  }
  _getOrCreateSlot(slotid) {
    if (!this._slotBySlotId.has(slotid)) {
      this._slotBySlotId.set(slotid, this._createSlot(slotid));
    }
    return this._slotBySlotId.get(slotid);
  }
  _createSlot(slotid) {
    return new Slot(slotid);
  }
  registerSlot(particleSpec, slotid) {
    return new Promise((resolve, reject) => {
      try {
        let slot = this._getOrCreateSlot(slotid);
        if (slot.isAvailable()) {
          resolve(slot);
        } else {
          slot.addPendingRequest(resolve);
        }
      } catch(x) {
        // TODO(sjmiles): my Promise-fu is not strong, probably should do something else
        reject(x);
      }
    }).then(slot => {
      slot.associateWithParticle(particleSpec);
      this._slotIdByParticleSpec.set(particleSpec, slotid);
    });
  }
  _getSlotId(particleSpec) {
    return this._slotIdByParticleSpec.get(particleSpec);
  }
  _getParticle(slotid) {
    if (this._slotBySlotId.has(slotid)) {
      return this._slotBySlotId.get(slotid)._particleSpec;
    }
  }
  _getSlot(slotid) {
    assert(this._slotBySlotId.has(slotid));
    return this._slotBySlotId.get(slotid);
  }
  _getParticleSlot(particleSpec) {
    return this._getSlot(this._getSlotId(particleSpec))
  }
  _makeEventletHandler(particleSpec) {
    return eventlet => {
      this._pec.sendEvent(particleSpec, eventlet)
    };
  }
  // TODO(sjmiles): should be `renderParticle`?
  renderSlot(particleSpec, content) {
    let slot = this._getParticleSlot(particleSpec);
    let handler = this._makeEventletHandler(particleSpec);
    // returns slot(id)s rendered by the particle
    let innerSlotInfos = slot.render(content, handler);
    if (innerSlotInfos) {
      // the `innerSlotInfos` identify available slot-contexts, make them available for composition
      this._provideInnerSlots(innerSlotInfos, particleSpec);
    }
  }
  _provideInnerSlots(innerSlotInfos, particleSpec) {
    innerSlotInfos.forEach(info => {
      let inner = this._getOrCreateSlot(info.id);
      // TODO(sjmiles): initialization will destroy content for DomSlot subclass, so we must cache it first
      // ... this is a leaky implementation detail
      let originalContent = inner.content;
      inner.initialize(info.context, particleSpec.exposeMap.get(info.id));
      if (originalContent) {
        // TODO(sjmiles): recurses
        this.renderSlot(this._getParticle(info.id), originalContent);
      } else {
        // TODO(sjmiles): falsey test for originalContent is an implicit signal, really don't we want `isAvailable()`?
        inner.providePendingSlot();
      }
    });
  }
  // particleSpec is relinquishing ownership of it's slot
  // TODO(sjmiles): should be `releaseParticle`?
  releaseSlot(particleSpec) {
    let slotid = this._getSlotId(particleSpec);
    if (slotid) {
      return this._releaseSlot(slotid);
    }
  }
  _releaseSlot(slotid) {
    this._disassociateSlotFromParticle(slotid);
    let slot = this._getSlot(slotid);
    // teardown rendering
    let lostInfos = slot.derender();
    // memoize list of particles who lost slots
    let affectedParticles = lostInfos.map(s => this._getParticle(s.id));
    // remove lost slots
    lostInfos.forEach(s => this._removeSlot(s.id));
    log(`slot-manager::_releaseSlotId("${slotid}"):`, affectedParticles);
    // released slot is now available for another requester
    slot.providePendingSlot();
    // return list of particles who lost slots
    return affectedParticles;
  }
  _disassociateSlotFromParticle(slotid) {
    let slot = this._slotBySlotId.get(slotid);
    this._slotIdByParticleSpec.delete(slot.particleSpec);
    slot.disassociateParticle();
  }
  // `remove` means to evacipate the slot context (`release` otoh means only to mark the slot as unused)
  _removeSlot(slotid) {
    this._disassociateSlotFromParticle(slotid);
    this._getSlot(slotid).uninitialize();
    this._slotBySlotId.delete(slotid);
  }
}

module.exports = SlotManager;
