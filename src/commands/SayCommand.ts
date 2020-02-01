/*
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { Mjolnir } from "../Mjolnir";
import { RichReply } from "matrix-bot-sdk";

// !mjolnir say <room alias/ID> <message>
export async function execSayCommand(roomId: string, event: any, mjolnir: Mjolnir, parts: string[]) {
    let targetRoomId = null;
    if (parts.length > 2 && (parts[2][0] === '#' || parts[2][0] === '!')) {
        targetRoomId = parts[2];
        if (parts[2][0] === '#') {
            targetRoomId = await mjolnir.client.resolveRoom(parts[2]);
        }
    }

    let sayMessage = null;
    if (parts.length > 3) {
        sayMessage = parts.splice(3).join(" ").trim();
    }

    let replyMessage = null;
    if (!targetRoomId) replyMessage = "Please specify a target room";
    else if (!sayMessage) replyMessage = "Please specify a message to say";

    if (replyMessage) {
        const reply = RichReply.createFor(roomId, event, replyMessage, replyMessage);
        reply["msgtype"] = "m.notice";
        await mjolnir.client.sendMessage(roomId, reply);
        return null;
    }

    await mjolnir.client.unstableApis.addReactionToEvent(roomId, event['event_id'], '✅');
    return mjolnir.client.sendMessage(targetRoomId, {
        msgtype: "m.text",
        body: sayMessage
    });
}
