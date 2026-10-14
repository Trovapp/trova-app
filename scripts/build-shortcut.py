#!/usr/bin/env python3
"""iOS 단축어 "Trova에 저장" 파일을 만든다(ADR 0013). 서명은 macOS `shortcuts sign --mode anyone`.

공유 시트에서 받은 링크(인스타·유튜브 공유 글 안의 첫 링크)를 Trova 백엔드 `POST /api/shares`에
공유 전용 키(헤더 X-Trova-Share-Key)와 함께 보내고 결과를 알림으로 보여준다.
키는 파일에 넣지 않는다 — 받을 때 "가져오기 질문"으로 사용자가 붙여넣는다.

사용: python3 scripts/build-shortcut.py <API 주소> <출력.shortcut> — 서명·파일 이름(NFC)은 docs/pwa.md
"""
import plistlib
import sys
import uuid

api, out = sys.argv[1].rstrip("/"), sys.argv[2]


def uid():
    return str(uuid.uuid4()).upper()


def output_ref(action_uuid, name):
    return {"Type": "ActionOutput", "OutputUUID": action_uuid, "OutputName": name}


def attachment(ref):
    return {"Value": ref, "WFSerializationType": "WFTextTokenAttachment"}


def token_string(text, refs=None):
    """글 안에 변수를 넣는 형식. refs: [(글자 위치, 참조)] — 위치에는 \\ufffc 한 글자가 들어 있어야 한다."""
    value = {"string": text}
    if refs:
        value["attachmentsByRange"] = {f"{{{pos}, 1}}": ref for pos, ref in refs}
    return {"Value": value, "WFSerializationType": "WFTextTokenString"}


def dict_field(items):
    return {
        "Value": {"WFDictionaryFieldValueItems": [
            {"WFItemType": 0, "WFKey": token_string(k), "WFValue": v} for k, v in items
        ]},
        "WFSerializationType": "WFDictionaryFieldValue",
    }


links, item, key_text, request, job_id = uid(), uid(), uid(), uid(), uid()
group = uid()
OBJ = "￼"

actions = [
    # 1. 공유받은 입력(링크 또는 공유 글)에서 링크만 꺼낸다. 이 동작의 입력 칸은 글자 칸이라 "단축어 입력"을 글 안 변수
    #    (텍스트 토큰)로 넣어야 한다 — 변수 연결(attachment)로 넣거나 비워 두면 iOS 26에서 입력이 비어 서버에 빈 링크가 갔다
    #    (2026-10-12 시뮬레이터에서 서버 로그 url= 빈 값으로 확인).
    {"WFWorkflowActionIdentifier": "is.workflow.actions.detect.link",
     "WFWorkflowActionParameters": {"UUID": links, "WFInput": token_string(OBJ, [(0, {"Type": "ExtensionInput"})])}},
    # 2. 첫 링크
    {"WFWorkflowActionIdentifier": "is.workflow.actions.getitemfromlist",
     "WFWorkflowActionParameters": {"UUID": item, "WFItemSpecifier": "First Item",
                                    "WFInput": attachment(output_ref(links, "URL"))}},
    # 3. 공유 전용 키 — 받을 때 가져오기 질문으로 채운다(파일에는 비어 있음)
    {"WFWorkflowActionIdentifier": "is.workflow.actions.gettext",
     "WFWorkflowActionParameters": {"UUID": key_text, "WFTextActionText": ""}},
    # 4. Trova에 보내기
    {"WFWorkflowActionIdentifier": "is.workflow.actions.downloadurl",
     "WFWorkflowActionParameters": {
         "UUID": request,
         "WFURL": f"{api}/api/shares",
         "WFHTTPMethod": "POST",
         "ShowHeaders": True,
         "WFHTTPHeaders": dict_field([
             ("X-Trova-Share-Key", token_string(OBJ, [(0, output_ref(key_text, "텍스트"))])),
             ("Content-Type", token_string("application/json")),
         ]),
         "WFHTTPBodyType": "JSON",
         "WFJSONValues": dict_field([
             ("url", token_string(OBJ, [(0, output_ref(item, "목록의 항목"))])),
         ]),
     }},
    # 5. 응답의 jobId
    {"WFWorkflowActionIdentifier": "is.workflow.actions.getvalueforkey",
     "WFWorkflowActionParameters": {"UUID": job_id, "WFDictionaryKey": "jobId",
                                    "WFInput": attachment(output_ref(request, "URL의 콘텐츠"))}},
    # 6. jobId가 있으면 성공
    {"WFWorkflowActionIdentifier": "is.workflow.actions.conditional",
     "WFWorkflowActionParameters": {"GroupingIdentifier": group, "WFControlFlowMode": 0, "WFCondition": 100,
                                    "WFInput": {"Type": "Variable", "Variable": attachment(output_ref(job_id, "사전 값"))}}},
    {"WFWorkflowActionIdentifier": "is.workflow.actions.notification",
     "WFWorkflowActionParameters": {"WFNotificationActionTitle": "Trova", "WFNotificationActionSound": False,
                                    "WFNotificationActionBody": "Trova에 보냈어요. 분석이 끝나면 앱에서 볼 수 있어요."}},
    {"WFWorkflowActionIdentifier": "is.workflow.actions.conditional",
     "WFWorkflowActionParameters": {"GroupingIdentifier": group, "WFControlFlowMode": 1}},
    {"WFWorkflowActionIdentifier": "is.workflow.actions.notification",
     "WFWorkflowActionParameters": {"WFNotificationActionTitle": "Trova", "WFNotificationActionSound": False,
                                    "WFNotificationActionBody": "저장하지 못했어요. 영상 링크인지, 키가 맞는지 확인해 주세요(마이페이지 → 아이폰 공유 단축어)."}},
    {"WFWorkflowActionIdentifier": "is.workflow.actions.conditional",
     "WFWorkflowActionParameters": {"GroupingIdentifier": group, "WFControlFlowMode": 2}},
]

workflow = {
    "WFWorkflowClientVersion": "2607.0.2",
    "WFWorkflowMinimumClientVersion": 900,
    "WFWorkflowMinimumClientVersionString": "900",
    "WFWorkflowHasShortcutInputVariables": True,
    "WFWorkflowIcon": {"WFWorkflowIconStartColor": 4282601983, "WFWorkflowIconGlyphNumber": 59511},
    "WFWorkflowTypes": ["ActionExtension"],
    "WFWorkflowInputContentItemClasses": ["WFURLContentItem", "WFStringContentItem"],
    "WFWorkflowOutputContentItemClasses": [],
    "WFWorkflowHasOutputFallback": False,
    "WFWorkflowNoInputBehavior": {"Name": "WFWorkflowNoInputBehaviorAskForInput", "Parameters": {"ItemClass": "WFStringContentItem"}},
    "WFWorkflowImportQuestions": [{
        "ActionIndex": 2, "Category": "Parameter", "DefaultValue": "", "ParameterKey": "WFTextActionText",
        "Text": "Trova 앱의 마이페이지 → ‘아이폰 공유 단축어’에서 받은 키를 붙여넣어 주세요.",
    }],
    "WFWorkflowActions": actions,
}

with open(out, "wb") as f:
    plistlib.dump(workflow, f, fmt=plistlib.FMT_BINARY)
print(f"작성: {out}")
