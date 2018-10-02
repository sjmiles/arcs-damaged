// @license
// Copyright (c) 2018 Google Inc. All rights reserved.
// This code may only be used under the BSD style license found at
// http://polymer.github.io/LICENSE.txt
// Code distributed by Google as part of this project is also
// subject to an additional IP rights grant found at
// http://polymer.github.io/PATENTS.txt

/**
 * External interface into remote planning to allow for clean
 * separation/isolation.
 */

import {UserPlanner} from './user-planner.js';
import {UserContext} from './shell/user-context.js';
import {ArcFactory} from './arc-factory.js';

const manifest = `
  import 'https://$artifacts/canonical.manifest'
`;

export class ShellPlanningInterface {
  /**
   * Starts a continuous shell planning import.
   *
   * @param assetsPath a path (relative or absolute) to locate planning assets.
   * @param userId the User Id to do planning for.
   */
  static async start(assetsPath, userId) {
    if (!assetsPath || !userId) {
      throw new Error('assetsPath and userId required');
    }
    // eslint-disable-next-line
    while (1) {
      try {
        const factory = new ArcFactory(assetsPath);
        const context = await factory.createContext(manifest);
        const user = new UserContext();
        user._setProps({userid, context});
        const planner = new UserPlanner(factory, context, userid);
      } catch (err) {
        console.warn('Error in Shell Planning, pausing for 5s', err);
        await new Promise((resolve) => setTimeout(() => resolve(), 5000));
      }
    }
  }
}

// These are sample users for testing.
ShellPlanningInterface.USER_ID_DOUG = '-LMtek9Mdy1iAc3MAkNx';
ShellPlanningInterface.USER_ID_MARIA = '-LMtek9Nzp8f5pwiLuF6';
ShellPlanningInterface.USER_ID_CLETUS = '-LMtek9LSN6eSMg97nXV';
ShellPlanningInterface.USER_ID_BERNI = '-LMtek9Mdy1iAc3MAkNw';