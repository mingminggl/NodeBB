"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const validator_1 = __importDefault(require("validator"));
const winston_1 = __importDefault(require("winston"));
const utils_1 = __importDefault(require("../utils"));
const slugify_1 = __importDefault(require("../slugify"));
const meta_1 = __importDefault(require("../meta"));
const database_1 = __importDefault(require("../database"));
const groups_1 = __importDefault(require("../groups"));
const plugins_1 = __importDefault(require("../plugins"));
function default_1(User) {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    User.updateProfile = function (uid, data, extraFields) {
        return __awaiter(this, void 0, void 0, function* () {
            let fields = [
                'username', 'email', 'fullname', 'website', 'location',
                'groupTitle', 'birthday', 'signature', 'aboutme',
            ];
            if (Array.isArray(extraFields)) {
                fields = lodash_1.default.uniq(fields.concat(extraFields));
            }
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            if (!data.uid) {
                throw new Error('[[error:invalid-update-uid]]');
            }
            const updateUid = data.uid;
            const result = yield plugins_1.default.hooks.fire('filter:user.updateProfile', {
                uid: uid,
                data: data,
                fields: fields,
            });
            fields = result.fields;
            data = result.data;
            yield validateData(uid, data);
            const oldData = yield User.getUserFields(updateUid, fields);
            const updateData = {};
            yield Promise.all(fields.map((field) => __awaiter(this, void 0, void 0, function* () {
                if (!(data[field] !== undefined && typeof data[field] === 'string')) {
                    return;
                }
                data[field] = data[field].trim();
                if (field === 'email') {
                    return yield updateEmail(updateUid, data.email);
                }
                else if (field === 'username') {
                    return yield updateUsername(updateUid, data.username);
                }
                else if (field === 'fullname') {
                    return yield updateFullname(updateUid, data.fullname);
                }
                updateData[field] = data[field];
            })));
            if (Object.keys(updateData).length) {
                yield User.setUserFields(updateUid, updateData);
            }
            plugins_1.default.hooks.fire('action:user.updateProfile', {
                uid: uid,
                data: data,
                fields: fields,
                oldData: oldData,
            });
            return yield User.getUserFields(updateUid, [
                'email', 'username', 'userslug',
                'picture', 'icon:text', 'icon:bgColor',
            ]);
        });
    };
    function validateData(callerUid, data) {
        return __awaiter(this, void 0, void 0, function* () {
            yield isEmailValid(data);
            yield isUsernameAvailable(data, data.uid);
            yield isWebsiteValid(callerUid, data);
            yield isAboutMeValid(callerUid, data);
            yield isSignatureValid(callerUid, data);
            isFullnameValid(data);
            isLocationValid(data);
            isBirthdayValid(data);
            isGroupTitleValid(data);
        });
    }
    function isEmailValid(data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data.email) {
                return;
            }
            data.email = data.email.trim();
            if (!utils_1.default.isEmailValid(data.email)) {
                throw new Error('[[error:invalid-email]]');
            }
        });
    }
    function isUsernameAvailable(data, uid) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (!data.username) {
                return;
            }
            data.username = (_a = data.username) === null || _a === void 0 ? void 0 : _a.trim();
            let userData;
            if (uid) {
                userData = yield User.getUserFields(uid, ['username', 'userslug']);
                if (userData.username === data.username) {
                    return;
                }
            }
            if (data.username.length < meta_1.default.config.minimumUsernameLength) {
                throw new Error('[[error:username-too-short]]');
            }
            if (data.username.length > meta_1.default.config.maximumUsernameLength) {
                throw new Error('[[error:username-too-long]]');
            }
            const userslug = (0, slugify_1.default)(data.username);
            if (!utils_1.default.isUserNameValid(data.username) || !userslug) {
                throw new Error('[[error:invalid-username]]');
            }
            if (uid && userslug === userData.userslug) {
                return;
            }
            const exists = yield User.existsBySlug(userslug);
            if (exists) {
                throw new Error('[[error:username-taken]]');
            }
            const { error } = yield plugins_1.default.hooks.fire('filter:username.check', {
                username: data.username,
                error: undefined,
            });
            if (error) {
                throw error;
            }
        });
    }
    User.checkUsername = (username, uid) => __awaiter(this, void 0, void 0, function* () { return isUsernameAvailable({ username }, { uid }); });
    function isWebsiteValid(callerUid, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data.website) {
                return;
            }
            if (data.website.length > 255) {
                throw new Error('[[error:invalid-website]]');
            }
            yield User.checkMinReputation(callerUid, data.uid, 'min:rep:website');
        });
    }
    function isAboutMeValid(callerUid, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data.aboutme) {
                return;
            }
            if (data.aboutme !== undefined && data.aboutme.length > meta_1.default.config.maximumAboutMeLength) {
                throw new Error(`[[error:about-me-too-long, ${meta_1.default.config.maximumAboutMeLength}]]`);
            }
            yield User.checkMinReputation(callerUid, data.uid, 'min:rep:aboutme');
        });
    }
    function isSignatureValid(callerUid, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data.signature) {
                return;
            }
            const signature = data.signature.replace(/\r\n/g, '\n');
            if (signature.length > meta_1.default.config.maximumSignatureLength) {
                throw new Error(`[[error:signature-too-long, ${meta_1.default.config.maximumSignatureLength}]]`);
            }
            yield User.checkMinReputation(callerUid, data.uid, 'min:rep:signature');
        });
    }
    function isFullnameValid(data) {
        if (data.fullname && (validator_1.default.isURL(data.fullname) || data.fullname.length > 255)) {
            throw new Error('[[error:invalid-fullname]]');
        }
    }
    function isLocationValid(data) {
        if (data.location && (validator_1.default.isURL(data.location) || data.location.length > 255)) {
            throw new Error('[[error:invalid-location]]');
        }
    }
    function isBirthdayValid(data) {
        if (!data.birthday) {
            return;
        }
        const result = new Date(data.birthday);
        if (result && result.toString() === 'Invalid Date') {
            throw new Error('[[error:invalid-birthday]]');
        }
    }
    function isGroupTitleValid(data) {
        function checkTitle(title) {
            if (title === 'registered-users' || groups_1.default.isPrivilegeGroup(title)) {
                throw new Error('[[error:invalid-group-title]]');
            }
        }
        if (!data.groupTitle) {
            return;
        }
        let groupTitles = [];
        if (validator_1.default.isJSON(data.groupTitle)) {
            groupTitles = JSON.parse(data.groupTitle);
            if (!Array.isArray(groupTitles)) {
                throw new Error('[[error:invalid-group-title]]');
            }
            groupTitles.forEach(title => checkTitle(title));
        }
        else {
            groupTitles = [data.groupTitle];
            checkTitle(data.groupTitle);
        }
        if (!meta_1.default.config.allowMultipleBadges && groupTitles.length > 1) {
            data.groupTitle = JSON.stringify(groupTitles[0]);
        }
    }
    User.checkMinReputation = function (callerUid, uid, setting) {
        return __awaiter(this, void 0, void 0, function* () {
            const roundedNumber1 = Math.round(uid * 10) / 10;
            const roundedNumber2 = Math.round(callerUid * 10) / 10;
            const isSelf = roundedNumber1 === roundedNumber2;
            if (!isSelf || meta_1.default.config['reputation:disabled']) {
                return;
            }
            const reputation = yield User.getUserField(uid, 'reputation');
            if (reputation < meta_1.default.config[setting]) {
                throw new Error(`[[error:not-enough-reputation-${setting.replace(/:/g, '-')}, ${meta_1.default.config[setting]}]]`);
            }
        });
    };
    function updateEmail(uid, newEmail) {
        return __awaiter(this, void 0, void 0, function* () {
            let oldEmail = yield User.getUserField(uid, 'email');
            oldEmail = oldEmail || '';
            if (oldEmail === newEmail) {
                return;
            }
            // 👉 Looking for email change logic? src/user/email.js (UserEmail.confirmByUid)
            if (newEmail) {
                yield User.email.sendValidationEmail(uid, {
                    email: newEmail,
                    force: 1,
                }).catch(err => winston_1.default.error(`[user.create] Validation email failed to send\n[emailer.send] ${err.stack}`));
            }
        });
    }
    function updateUsername(uid, newUsername) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!newUsername) {
                return;
            }
            const userData = yield User.getUserFields(uid, ['username', 'userslug']);
            if (userData.username === newUsername) {
                return;
            }
            const newUserslug = (0, slugify_1.default)(newUsername);
            const now = Date.now();
            yield Promise.all([
                updateUidMapping('username', uid, newUsername, userData.username),
                updateUidMapping('userslug', uid, newUserslug, userData.userslug),
                database_1.default.sortedSetAdd(`user:${uid}:usernames`, now, `${newUsername}:${now}`),
            ]);
            yield database_1.default.sortedSetRemove('username:sorted', `${userData.username.toLowerCase()}:${uid}`);
            yield database_1.default.sortedSetAdd('username:sorted', 0, `${newUsername.toLowerCase()}:${uid}`);
        });
    }
    function updateUidMapping(field, uid, value, oldValue) {
        return __awaiter(this, void 0, void 0, function* () {
            if (value === oldValue) {
                return;
            }
            yield database_1.default.sortedSetRemove(`${field}:uid`, oldValue);
            yield User.setUserField(uid, field, value);
            if (value) {
                yield database_1.default.sortedSetAdd(`${field}:uid`, uid, value);
            }
        });
    }
    function updateFullname(uid, newFullname) {
        return __awaiter(this, void 0, void 0, function* () {
            const fullname = yield User.getUserField(uid, 'fullname');
            yield updateUidMapping('fullname', uid, newFullname, fullname);
            if (newFullname !== fullname) {
                if (fullname) {
                    yield database_1.default.sortedSetRemove('fullname:sorted', `${fullname.toLowerCase()}:${uid}`);
                }
                if (newFullname) {
                    yield database_1.default.sortedSetAdd('fullname:sorted', 0, `${newFullname.toLowerCase()}:${uid}`);
                }
            }
        });
    }
    User.changePassword = function (uid, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (uid <= 0 || !data || !data.uid) {
                throw new Error('[[error:invalid-uid]]');
            }
            User.isPasswordValid(data.newPassword);
            const [isAdmin, hasPassword] = yield Promise.all([
                User.isAdministrator(uid),
                User.hasPassword(uid),
            ]);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            if (meta_1.default.config['password:disableEdit'] && !isAdmin) {
                throw new Error('[[error:no-privileges]]');
            }
            const roundedNumber1 = Math.round(uid * 10) / 10;
            const roundedNumber2 = Math.round(data.uid * 10) / 10;
            const isSelf = roundedNumber1 === roundedNumber2;
            if (!isAdmin && !isSelf) {
                throw new Error('[[user:change_password_error_privileges]]');
            }
            if (isSelf && hasPassword) {
                const correct = yield User.isPasswordCorrect(data.uid, data.currentPassword, data.ip);
                if (!correct) {
                    throw new Error('[[user:change_password_error_wrong_current]]');
                }
            }
            const hashedPassword = yield User.hashPassword(data.newPassword);
            yield Promise.all([
                User.setUserFields(data.uid, {
                    password: hashedPassword,
                    'password:shaWrapped': 1,
                    // The next line calls a function in a module that has not been updated to TS yet
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    rss_token: utils_1.default.generateUUID(),
                }),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                User.reset.cleanByUid(data.uid),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                User.reset.updateExpiry(data.uid),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                User.auth.revokeAllSessions(data.uid),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                User.email.expireValidation(data.uid),
            ]);
            plugins_1.default.hooks.fire('action:password.change', { uid: uid, targetUid: data.uid });
        });
    };
}
exports.default = default_1;
