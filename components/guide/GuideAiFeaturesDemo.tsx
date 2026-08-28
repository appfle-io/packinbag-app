"use client";

import { useState } from "react";
import {
  IconCheck,
  IconPlus,
  IconLoader2,
  IconRefresh,
} from "@tabler/icons-react";

type AiTab = "clipboard" | "spreadsheet" | "audit" | "weather";

export default function GuideAiFeaturesDemo() {
  const [activeTab, setActiveTab] = useState<AiTab>("clipboard");

  // 클립보드 AI 상태
  const [clipboardStep, setClipboardStep] = useState<"idle" | "loading" | "done">("idle");

  // 스프레드시트 AI 상태
  const [sheetStep, setSheetStep] = useState<"idle" | "loading" | "done">("idle");

  // 가방 점검 AI 상태
  const [auditStep, setAuditStep] = useState<"idle" | "loading" | "done">("idle");
  const [addedAuditItems, setAddedAuditItems] = useState<string[]>([]);

  // 여행지/날씨 AI 상태
  const [selectedCity, setSelectedCity] = useState<"osaka" | "danang" | "paris">("osaka");
  const [weatherStep, setWeatherStep] = useState<"idle" | "loading" | "done">("idle");

  const handleSimulateClipboard = () => {
    setClipboardStep("loading");
    setTimeout(() => {
      setClipboardStep("done");
    }, 700);
  };

  const handleSimulateSheet = () => {
    setSheetStep("loading");
    setTimeout(() => {
      setSheetStep("done");
    }, 700);
  };

  const handleSimulateAudit = () => {
    setAuditStep("loading");
    setTimeout(() => {
      setAuditStep("done");
    }, 700);
  };

  const handleSimulateWeather = () => {
    setWeatherStep("loading");
    setTimeout(() => {
      setWeatherStep("done");
    }, 700);
  };

  const handleAddAuditItem = (text: string) => {
    if (!addedAuditItems.includes(text)) {
      setAddedAuditItems((prev) => [...prev, text]);
    }
  };

  return (
    <div className="w-full flex flex-col gap-3 select-none">
      {/* 상단 4종 탭 바 (이모지/아이콘 제거) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-xl bg-surface-2/60 border border-border/40 text-[12px]">
        <button
          type="button"
          onClick={() => setActiveTab("clipboard")}
          className={`flex items-center justify-center py-2 px-2 rounded-lg font-medium transition-colors cursor-pointer ${
            activeTab === "clipboard"
              ? "bg-surface text-accent shadow-xs font-bold"
              : "text-text-muted hover:text-foreground"
          }`}
        >
          <span>클립보드 AI</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("spreadsheet")}
          className={`flex items-center justify-center py-2 px-2 rounded-lg font-medium transition-colors cursor-pointer ${
            activeTab === "spreadsheet"
              ? "bg-surface text-accent shadow-xs font-bold"
              : "text-text-muted hover:text-foreground"
          }`}
        >
          <span>스프레드시트 AI</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          className={`flex items-center justify-center py-2 px-2 rounded-lg font-medium transition-colors cursor-pointer ${
            activeTab === "audit"
              ? "bg-surface text-accent shadow-xs font-bold"
              : "text-text-muted hover:text-foreground"
          }`}
        >
          <span>가방 점검 AI</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("weather")}
          className={`flex items-center justify-center py-2 px-2 rounded-lg font-medium transition-colors cursor-pointer ${
            activeTab === "weather"
              ? "bg-surface text-accent shadow-xs font-bold"
              : "text-text-muted hover:text-foreground"
          }`}
        >
          <span>날씨·명소 AI</span>
        </button>
      </div>

      {/* 탭 1: 클립보드 AI */}
      {activeTab === "clipboard" && (
        <div className="p-3.5 rounded-2xl border border-border bg-white dark:bg-surface flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-bold text-foreground">메모 텍스트 자동 분류</span>
            {clipboardStep === "done" && (
              <button
                type="button"
                onClick={() => setClipboardStep("idle")}
                className="flex items-center gap-1 text-[11px] text-text-muted hover:text-foreground cursor-pointer"
              >
                <IconRefresh size={12} />
                <span>다시 하기</span>
              </button>
            )}
          </div>

          {clipboardStep === "idle" && (
            <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-white dark:bg-surface-2 border border-border shadow-xs text-[12px]">
              <div className="font-mono text-text-secondary whitespace-pre-line leading-relaxed text-[11.5px] bg-white dark:bg-surface p-2.5 rounded-lg border border-border">
                {`여권, 지갑, 보조배터리 20000mAh
반팔 3벌, 청바지 2벌, 속옷 4세트
C타입 충전선, 110V 돼지코 어댑터`}
              </div>
              <button
                type="button"
                onClick={handleSimulateClipboard}
                className="w-full flex items-center justify-center py-2.5 rounded-lg bg-accent text-white font-semibold text-[12.5px] hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
              >
                <span>AI 사용해보기</span>
              </button>
            </div>
          )}

          {clipboardStep === "loading" && (
            <div className="py-6 flex flex-col items-center justify-center gap-2 text-text-muted text-[12px] bg-white dark:bg-surface-2 rounded-xl border border-border shadow-xs">
              <IconLoader2 size={20} className="animate-spin text-accent" />
              <span>AI가 팩과 짐으로 분류하고 있어요...</span>
            </div>
          )}

          {clipboardStep === "done" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[12px]">
              <div className="p-3 rounded-xl border border-border bg-white dark:bg-surface-2 flex flex-col gap-1.5 shadow-xs">
                <span className="font-bold text-accent text-[12px]">의류 팩 (3개)</span>
                <div className="flex flex-col gap-1 text-[11.5px] text-text-secondary">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                    <span>반팔 3벌</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                    <span>청바지 2벌</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                    <span>속옷 4세트</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-border bg-white dark:bg-surface-2 flex flex-col gap-1.5 shadow-xs">
                <span className="font-bold text-accent text-[12px]">전자기기 및 필수품 (3개)</span>
                <div className="flex flex-col gap-1 text-[11.5px] text-text-secondary">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                    <span>여권 및 지갑</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                    <span>보조배터리 20000mAh</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                    <span>110V 돼지코 어댑터</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 탭 2: 스프레드시트 AI */}
      {activeTab === "spreadsheet" && (
        <div className="p-3.5 rounded-2xl border border-border bg-white dark:bg-surface flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-bold text-foreground">구글 시트 표 변환</span>
            {sheetStep === "done" && (
              <button
                type="button"
                onClick={() => setSheetStep("idle")}
                className="flex items-center gap-1 text-[11px] text-text-muted hover:text-foreground cursor-pointer"
              >
                <IconRefresh size={12} />
                <span>다시 하기</span>
              </button>
            )}
          </div>

          {sheetStep === "idle" && (
            <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-white dark:bg-surface-2 border border-border shadow-xs text-[12px]">
              <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white dark:bg-surface border border-border text-[11.5px] font-mono text-text-secondary truncate">
                <span className="truncate">https://docs.google.com/spreadsheets/d/1Jp7a...</span>
              </div>
              <button
                type="button"
                onClick={handleSimulateSheet}
                className="w-full flex items-center justify-center py-2.5 rounded-lg bg-accent text-white font-semibold text-[12.5px] hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
              >
                <span>AI 사용해보기</span>
              </button>
            </div>
          )}

          {sheetStep === "loading" && (
            <div className="py-6 flex flex-col items-center justify-center gap-2 text-text-muted text-[12px] bg-white dark:bg-surface-2 rounded-xl border border-border shadow-xs">
              <IconLoader2 size={20} className="animate-spin text-accent" />
              <span>격자 표와 메모팩으로 변환하고 있어요...</span>
            </div>
          )}

          {sheetStep === "done" && (
            <div className="flex flex-col gap-2.5 text-[12px]">
              <div className="p-3 rounded-xl border border-border bg-white dark:bg-surface-2 flex flex-col gap-2 shadow-xs">
                <span className="font-bold text-accent text-[12px]">항공편 스케줄</span>
                <div className="overflow-x-auto border border-border/80 rounded-md bg-white dark:bg-surface">
                  <table className="w-full text-[11px] text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-2/60 border-b border-border/60 font-semibold">
                        <th className="p-1.5 border-r border-border/40">구분</th>
                        <th className="p-1.5 border-r border-border/40">노선</th>
                        <th className="p-1.5 border-r border-border/40">편명</th>
                        <th className="p-1.5">터미널</th>
                      </tr>
                    </thead>
                    <tbody className="text-text-secondary">
                      <tr className="border-b border-border/30">
                        <td className="p-1.5 border-r border-border/30">출국</td>
                        <td className="p-1.5 border-r border-border/30">인천 -&gt; 호놀룰루</td>
                        <td className="p-1.5 border-r border-border/30">YP151</td>
                        <td className="p-1.5">제1터미널</td>
                      </tr>
                      <tr>
                        <td className="p-1.5 border-r border-border/30">귀국</td>
                        <td className="p-1.5 border-r border-border/30">호놀룰루 -&gt; 인천</td>
                        <td className="p-1.5 border-r border-border/30">YP152</td>
                        <td className="p-1.5">제2터미널</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-border bg-white dark:bg-surface-2 flex flex-col gap-1.5 shadow-xs">
                <span className="font-bold text-accent text-[12px]">체크리스트</span>
                <div className="flex flex-col gap-1 text-[11.5px]">
                  <div className="flex items-center gap-1.5 text-text-muted">
                    <span className="font-mono text-emerald-600 font-bold">[✓]</span>
                    <span className="line-through">국제면허증 발급 완료</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-text-secondary">
                    <span className="font-mono text-text-muted font-bold">[ ]</span>
                    <span>eSim 구매 및 데이터 확인</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 탭 3: 가방 점검 AI */}
      {activeTab === "audit" && (
        <div className="p-3.5 rounded-2xl border border-border bg-white dark:bg-surface flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-bold text-foreground">빠진 짐 AI 감사</span>
            {auditStep === "done" && (
              <button
                type="button"
                onClick={() => {
                  setAuditStep("idle");
                  setAddedAuditItems([]);
                }}
                className="flex items-center gap-1 text-[11px] text-text-muted hover:text-foreground cursor-pointer"
              >
                <IconRefresh size={12} />
                <span>다시 하기</span>
              </button>
            )}
          </div>

          {auditStep === "idle" && (
            <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-white dark:bg-surface-2 border border-border shadow-xs text-[12px]">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-surface border border-border text-[12px]">
                <span className="font-bold text-foreground">도쿄 3박 4일 자유여행</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent-soft text-accent font-medium">
                  현재 8개 등록됨
                </span>
              </div>
              <button
                type="button"
                onClick={handleSimulateAudit}
                className="w-full flex items-center justify-center py-2.5 rounded-lg bg-accent text-white font-semibold text-[12.5px] hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
              >
                <span>AI 사용해보기</span>
              </button>
            </div>
          )}

          {auditStep === "loading" && (
            <div className="py-6 flex flex-col items-center justify-center gap-2 text-text-muted text-[12px] bg-white dark:bg-surface-2 rounded-xl border border-border shadow-xs">
              <IconLoader2 size={20} className="animate-spin text-accent" />
              <span>빠진 필수품을 분석하고 있어요...</span>
            </div>
          )}

          {auditStep === "done" && (
            <div className="flex flex-col gap-2 text-[12px]">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-text-secondary text-[11.5px]">
                <span className="font-semibold text-foreground">AI 진단:</span> 110V 어댑터와 모바일 입국 심사 등록이 누락되었습니다.
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-white dark:bg-surface-2 shadow-xs">
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground text-[12px]">110V 돼지코 어댑터</span>
                    <span className="text-[10.5px] text-text-muted">호텔 전압 호환</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddAuditItem("110V 돼지코")}
                    disabled={addedAuditItems.includes("110V 돼지코")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      addedAuditItems.includes("110V 돼지코")
                        ? "bg-emerald-600/10 text-emerald-600 border border-emerald-600/20"
                        : "bg-accent text-white hover:opacity-90 shadow-2xs"
                    }`}
                  >
                    {addedAuditItems.includes("110V 돼지코") ? (
                      <>
                        <IconCheck size={12} stroke={2.5} />
                        <span>추가됨</span>
                      </>
                    ) : (
                      <>
                        <IconPlus size={12} />
                        <span>추가</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-white dark:bg-surface-2 shadow-xs">
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground text-[12px]">비짓재팬웹 등록</span>
                    <span className="text-[10.5px] text-text-muted">입국 심사 QR</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddAuditItem("비짓재팬웹")}
                    disabled={addedAuditItems.includes("비짓재팬웹")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      addedAuditItems.includes("비짓재팬웹")
                        ? "bg-emerald-600/10 text-emerald-600 border border-emerald-600/20"
                        : "bg-accent text-white hover:opacity-90 shadow-2xs"
                    }`}
                  >
                    {addedAuditItems.includes("비짓재팬웹") ? (
                      <>
                        <IconCheck size={12} stroke={2.5} />
                        <span>추가됨</span>
                      </>
                    ) : (
                      <>
                        <IconPlus size={12} />
                        <span>추가</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 탭 4: 날씨 및 명소 AI */}
      {activeTab === "weather" && (
        <div className="p-3.5 rounded-2xl border border-border bg-white dark:bg-surface flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-bold text-foreground">도시별 날씨 · 추천</span>
            {weatherStep === "done" && (
              <button
                type="button"
                onClick={() => setWeatherStep("idle")}
                className="flex items-center gap-1 text-[11px] text-text-muted hover:text-foreground cursor-pointer"
              >
                <IconRefresh size={12} />
                <span>다시 하기</span>
              </button>
            )}
          </div>

          <div className="flex gap-1.5 text-[11.5px]">
            <button
              type="button"
              onClick={() => {
                setSelectedCity("osaka");
                if (weatherStep === "done") setWeatherStep("done");
              }}
              className={`px-3 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer ${
                selectedCity === "osaka"
                  ? "border-accent bg-accent text-white shadow-2xs font-semibold"
                  : "border-border bg-white dark:bg-surface text-text-secondary hover:text-foreground"
              }`}
            >
              오사카
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedCity("danang");
                if (weatherStep === "done") setWeatherStep("done");
              }}
              className={`px-3 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer ${
                selectedCity === "danang"
                  ? "border-accent bg-accent text-white shadow-2xs font-semibold"
                  : "border-border bg-white dark:bg-surface text-text-secondary hover:text-foreground"
              }`}
            >
              다낭
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedCity("paris");
                if (weatherStep === "done") setWeatherStep("done");
              }}
              className={`px-3 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer ${
                selectedCity === "paris"
                  ? "border-accent bg-accent text-white shadow-2xs font-semibold"
                  : "border-border bg-white dark:bg-surface text-text-secondary hover:text-foreground"
              }`}
            >
              파리
            </button>
          </div>

          {weatherStep === "idle" && (
            <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-white dark:bg-surface-2 border border-border shadow-xs text-[12px]">
              <div className="p-2.5 rounded-lg bg-white dark:bg-surface border border-border text-[11.5px] text-text-secondary leading-relaxed">
                도시를 선택하고 AI로 현지 기온, 날씨 주의사항 및 맞춤 준비물 추천을 받아보세요.
              </div>
              <button
                type="button"
                onClick={handleSimulateWeather}
                className="w-full flex items-center justify-center py-2.5 rounded-lg bg-accent text-white font-semibold text-[12.5px] hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
              >
                <span>AI 사용해보기</span>
              </button>
            </div>
          )}

          {weatherStep === "loading" && (
            <div className="py-6 flex flex-col items-center justify-center gap-2 text-text-muted text-[12px] bg-white dark:bg-surface-2 rounded-xl border border-border shadow-xs">
              <IconLoader2 size={20} className="animate-spin text-accent" />
              <span>현지 날씨와 맞춤 준비물을 분석하고 있어요...</span>
            </div>
          )}

          {weatherStep === "done" && (
            <div className="p-3.5 rounded-xl border border-border bg-white dark:bg-surface-2 flex flex-col gap-2.5 text-[12px] shadow-xs">
              {selectedCity === "osaka" && (
                <>
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <div>
                      <span className="font-semibold text-foreground">오사카, 일본</span>
                      <p className="text-[11px] text-text-muted mt-0.5">평균 기온 22°C · 맑음</p>
                    </div>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-600/10 text-emerald-600">
                      활동하기 좋은 날씨
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 text-[11.5px] text-text-secondary">
                    <span className="font-medium text-foreground">추천 준비물:</span>
                    <p>가벼운 가디건, 편안한 도보용 운동화, 보조배터리, 지하철 패스</p>
                  </div>
                </>
              )}

              {selectedCity === "danang" && (
                <>
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <div>
                      <span className="font-semibold text-foreground">다낭, 베트남</span>
                      <p className="text-[11px] text-text-muted mt-0.5">평균 기온 31°C · 자외선 강함</p>
                    </div>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-600">
                      더위 및 햇빛 주의
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 text-[11.5px] text-text-secondary">
                    <span className="font-medium text-foreground">추천 준비물:</span>
                    <p>선크림 SPF50+, 선글라스, 방수팩, 휴대용 선풍기, 모기 기피제</p>
                  </div>
                </>
              )}

              {selectedCity === "paris" && (
                <>
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <div>
                      <span className="font-semibold text-foreground">파리, 프랑스</span>
                      <p className="text-[11px] text-text-muted mt-0.5">평균 기온 15°C · 일교차 큼</p>
                    </div>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-sky-500/10 text-sky-600">
                      일교차 주의
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 text-[11.5px] text-text-secondary">
                    <span className="font-medium text-foreground">추천 준비물:</span>
                    <p>바람막이 자켓, 스카프, 접이식 3단 우산, 유럽용 C형 멀티플러그</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
