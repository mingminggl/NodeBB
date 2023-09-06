import _ from 'lodash';
import validator from 'validator';
import winston from 'winston';

import * as utils from '../utils';
import slugify from '../slugify';
import * as meta from '../meta';
import * as db from '../database';
import * as groups from '../groups';
import * as plugins from '../plugins';

export default function (User: any) {
  User.updateProfile = async function (uid: number, data: any, extraFields: string[] | undefined) {
    let fields: string[] = [
      'username', 'email', 'fullname', 'website', 'location',
      'groupTitle', 'birthday', 'signature', 'aboutme',
    ];
    if (Array.isArray(extraFields)) {
      fields = _.uniq(fields.concat(extraFields));
    }
    if (!data.uid) {
      throw new Error('[[error:invalid-update-uid]]');
    }
    const updateUid = data.uid;

    const result = await plugins.hooks.fire('filter:user.updateProfile', {
      uid: uid,
      data: data,
      fields: fields,
    });
    fields = result.fields;
    data = result.data;

    await validateData(uid, data);

    const oldData = await User.getUserFields(updateUid, fields);
    const updateData: any = {};
    await Promise.all(fields.map(async (field) => {
      if (!(data[field] !== undefined && typeof data[field] === 'string')) {
        return;
      }

      data[field] = data[field].trim();

      if (field === 'email') {
        return await updateEmail(updateUid, data.email);
      } else if (field === 'username') {
        return await updateUsername(updateUid, data.username);
      } else if (field === 'fullname') {
        return await updateFullname(updateUid, data.fullname);
      }
      updateData[field] = data[field];
    }));

    if (Object.keys(updateData).length) {
      await User.setUserFields(updateUid, updateData);
    }

    plugins.hooks.fire('action:user.updateProfile', {
      uid: uid,
      data: data,
      fields: fields,
      oldData: oldData,
    });

    return await User.getUserFields(updateUid, [
      'email', 'username', 'userslug',
      'picture', 'icon:text', 'icon:bgColor',
    ]);
  };

  async function validateData(callerUid: number, data: any) {
    await isEmailValid(data);
    await isUsernameAvailable(data, data.uid);
    await isWebsiteValid(callerUid, data);
    await isAboutMeValid(callerUid, data);
    await isSignatureValid(callerUid, data);
    isFullnameValid(data);
    isLocationValid(data);
    isBirthdayValid(data);
    isGroupTitleValid(data);
  }

  async function isEmailValid(data: any) {
    if (!data.email) {
      return;
    }

    data.email = data.email.trim();
    if (!utils.isEmailValid(data.email)) {
      throw new Error('[[error:invalid-email]]');
    }
  }

  async function isUsernameAvailable(data: any, uid: number | undefined) {
    if (!data.username) {
      return;
    }
    data.username = data.username.trim();

    let userData: any;
    if (uid) {
      userData = await User.getUserFields(uid, ['username', 'userslug']);
      if (userData.username === data.username) {
        return;
      }
    }

    if (data.username.length < meta.config.minimumUsernameLength) {
      throw new Error('[[error:username-too-short]]');
    }

    if (data.username.length > meta.config.maximumUsernameLength) {
      throw new Error('[[error:username-too-long]]');
    }

    const userslug = slugify(data.username);
    if (!utils.isUserNameValid(data.username) || !userslug) {
      throw new Error('[[error:invalid-username]]');
    }

    if (uid && userslug === userData.userslug) {
      return;
    }
    const exists = await User.existsBySlug(userslug);
    if (exists) {
      throw new Error('[[error:username-taken]]');
    }

    const { error } = await plugins.hooks.fire('filter:username.check', {
      username: data.username,
      error: undefined,
    });
    if (error) {
      throw error;
    }
  }

  User.checkUsername = async (username: string) => isUsernameAvailable({ username });

  async function isWebsiteValid(callerUid: number, data: any) {
    if (!data.website) {
      return;
    }
    if (data.website.length > 255) {
      throw new Error('[[error:invalid-website]]');
    }
    await User.checkMinReputation(callerUid, data.uid, 'min:rep:website');
  }

  async function isAboutMeValid(callerUid: number, data: any) {
    if (!data.aboutme) {
      return;
    }
    if (data.aboutme !== undefined && data.aboutme.length > meta.config.maximumAboutMeLength) {
      throw new Error(`[[error:about-me-too-long, ${meta.config.maximumAboutMeLength}]]`);
    }

    await User.checkMinReputation(callerUid, data.uid, 'min:rep:aboutme');
  }

  async function isSignatureValid(callerUid: number, data: any) {
    if (!data.signature) {
      return;
    }
    const signature = data.signature.replace(/\r\n/g, '\n');
    if (signature.length > meta.config.maximumSignatureLength) {
      throw new Error(`[[error:signature-too-long, ${meta.config.maximumSignatureLength}]]`);
    }
    await User.checkMinReputation(callerUid, data.uid, 'min:rep:signature');
  }

  function isFullnameValid(data: any) {
    if (data.fullname && (validator.isURL(data.fullname) || data.fullname.length > 255)) {
      throw new Error('[[error:invalid-fullname]]');
    }
  }

  function isLocationValid(data: any) {
    if (data.location && (validator.isURL(data.location) || data.location.length > 255)) {
      throw new Error('[[error:invalid-location]]');
    }
  }

  function isBirthdayValid(data: any) {
    if (!data.birthday) {
      return;
    }

    const result = new Date(data.birthday);
    if (result && result.toString() === 'Invalid Date') {
      throw new Error('[[error:invalid-birthday]]');
    }
  }

  function isGroupTitleValid(data: any) {
    function checkTitle(title: string) {
      if (title === 'registered-users' || groups.isPrivilegeGroup(title)) {
        throw new Error('[[error:invalid-group-title]]');
      }
    }
    if (!data.groupTitle) {
      return;
    }
    let groupTitles: string[] = [];
    if (validator.isJSON(data.groupTitle)) {
      groupTitles = JSON.parse(data.groupTitle);
      if (!Array.isArray(groupTitles)) {
        throw new Error('[[error:invalid-group-title]]');
      }
      groupTitles.forEach(title => checkTitle(title));
    }
  }
}