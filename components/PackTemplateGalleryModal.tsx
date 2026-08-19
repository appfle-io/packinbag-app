"use client";

import { useMemo, useState } from "react";
import { IconX, IconSparkles, IconCheck, IconDownload, IconBriefcase, IconCompass, IconTent, IconBabyCarriage, IconSwimming, IconPlus, IconLoader2 } from "@tabler/icons-react";
import { Pack } from "@/lib/types";
import Portal from "@/components/Portal";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/contexts/AuthProvider";
import PackColorDot from "@/components/PackColorDot";
import { useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";

export interface PresetPackTemplate {
  id: string;
  name: string;
  category: "travel" | "camping" | "baby" | "business" | "leisure" | "custom";
  categoryLabel: string;
  description: string;
  color?: string;
  items: { text: string; type: "check" | "text" }[];
}

export const PRESET_PACK_TEMPLATES: PresetPackTemplate[] = [
  {
    id: "tpl-overseas",
    name: "해외여행 필수품 팩",
    category: "travel",
    categoryLabel: "해외여행",
    description: "해외 출국 전 꼭 확인해야 할 필수 서류 및 필수템 세트",
    color: "blue",
    items: [
      { text: "여권 및 여권 사본 (사진)", type: "check" },
      { text: "항공권 이티켓 & 호텔 예약증", type: "check" },
      { text: "환전 현금 & 트래블 체크카드", type: "check" },
      { text: "해외용 멀티 어댑터 & 돼지코", type: "check" },
      { text: "eSIM / 포켓와이파이 / 유심", type: "check" },
      { text: "여행자 보험 가입 확인서", type: "check" },
      { text: "비상약 (소화제, 감기약, 지사제, 대두밴드)", type: "check" },
    ],
  },
  {
    id: "tpl-camping-cook",
    name: "감성 캠핑 쿡웨어 팩",
    category: "camping",
    categoryLabel: "캠핑/차박",
    description: "캠핑장에서 요리할 때 필요한 기본 주방 및 취사도구 모음",
    color: "amber",
    items: [
      { text: "그리들 / 구이바다 / 그리들 팬", type: "check" },
      { text: "휴대용 버너 & 이소가스 / 부탄가스", type: "check" },
      { text: "캠핑 수저세트 & 조리도구 (집게, 가위, 칼)", type: "check" },
      { text: "도마 & 키친타월 & 양념통 세트", type: "check" },
      { text: "오프너 & 컵 / 시에라컵", type: "check" },
      { text: "설거지통 & 친환경 수세미 & 세제", type: "check" },
    ],
  },
  {
    id: "tpl-baby-outing",
    name: "아이와 외출/여행 팩",
    category: "baby",
    categoryLabel: "육아/아이짐",
    description: "아기와 함께 떠날 때 빠뜨리기 쉬운 육아 필수품",
    color: "rose",
    items: [
      { text: "분유 / 보온병 / 젖병 & 소독용품", type: "check" },
      { text: "넉넉한 기저귀 & 아기 물티슈", type: "check" },
      { text: "여벌 옷 2~3벌 & 턱받이/침받이", type: "check" },
      { text: "체온계 & 해열제 & 어린이 상처밴드", type: "check" },
      { text: "애착 인형 / 사운드북 / 간식", type: "check" },
      { text: "휴대용 아기 띠 / 유모차 쿨시트", type: "check" },
    ],
  },
  {
    id: "tpl-domestic-trip",
    name: "국내 1박 2일 여행 팩",
    category: "travel",
    categoryLabel: "국내여행",
    description: "부담 없이 주말에 가볍게 떠나는 여행 기본 팩",
    color: "emerald",
    items: [
      { text: "갈아입을 옷 & 속옷 & 양말", type: "check" },
      { text: "세면도구 (칫솔, 치약, 폼클렌징)", type: "check" },
      { text: "스킨케어 / 선크림 / 화장품", type: "check" },
      { text: "스마트폰 충전기 & 보조배터리", type: "check" },
      { text: "편안한 잠옷 / 슬리퍼", type: "check" },
    ],
  },
  {
    id: "tpl-business-work",
    name: "스마트 워크 & 출장 팩",
    category: "business",
    categoryLabel: "출장/비즈니스",
    description: "업무 생산성을 유지해 주는 스마트 기기 및 비즈니스 소품",
    color: "indigo",
    items: [
      { text: "노트북 & 전원 어댑터 & 마우스", type: "check" },
      { text: "C타입 / 8핀 / 멀티 케이블", type: "check" },
      { text: "명함 / 계약 서류 및 케이스", type: "check" },
      { text: "노이즈 캔슬링 이어폰 / 헤드셋", type: "check" },
      { text: "비타민 & 영양제 파우치", type: "check" },
    ],
  },
  {
    id: "tpl-water-beach",
    name: "바다/워터파크 휴양 팩",
    category: "leisure",
    categoryLabel: "휴양/물놀이",
    description: "물놀이와 물놀이 후 깔끔한 정리를 위한 팩",
    color: "sky",
    items: [
      { text: "수영복 / 래시가드 / 아쿠아슈즈", type: "check" },
      { text: "스마트폰 방수팩 & 선글라스", type: "check" },
      { text: "강력 워터프루프 선크림 / 쿨링 알로에", type: "check" },
      { text: "비치타월 & 젖은 옷 담을 드라이백", type: "check" },
      { text: "모자 / 캡 / 튜브 / 펌프", type: "check" },
    ],
  },
  {
    id: "tpl-fitness-gym",
    name: "오운완 헬스/운동 팩",
    category: "leisure",
    categoryLabel: "운동/레저",
    description: "매일 운동갈 때 챙기는 헬스 파우치",
    color: "purple",
    items: [
      { text: "운동화 / 스트랩 / 글러브", type: "check" },
      { text: "운동용 타월 & 텀블러/쉐이커", type: "check" },
      { text: "단백질 파우더 & BCAA / 이온음료", type: "check" },
      { text: "샤워용품 파우치 & 갈아입을 옷", type: "check" },
    ],
  },
];

let userRegisteredTemplates: PresetPackTemplate[] = [];

export function registerPackAsTemplate(pack: Pack, categoryLabel = "커스텀"): PresetPackTemplate {
  const tpl: PresetPackTemplate = {
    id: `custom-tpl-${Date.now()}`,
    name: pack.name,
    category: "custom",
    categoryLabel,
    description: `사용자가 직접 공유 등록한 추천 팩 (${pack.items.length}개 항목)`,
    color: pack.color,
    items: pack.items.map((i) => ({ text: i.text, type: i.type })),
  };
  userRegisteredTemplates = [tpl, ...userRegisteredTemplates];
  return tpl;
}

export default function PackTemplateGalleryModal({
  userPacks = [],
  onClose,
  onImportToLibrary,
}: {
  userPacks?: Pack[];
  onClose: () => void;
  onImportToLibrary: (pack: Pack) => void;
}) {
  const { show } = useToast();
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<"gallery" | "myPacks">("gallery");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [importedSet, setImportedSet] = useState<Set<string>>(new Set());
  const [isInspecting, setIsInspecting] = useState(false);
  const ambientLayer = useOverlayLayer();
  const resolvedZIndex = ambientLayer + POPOVER_OFFSET;
  useEscapeToClose(isInspecting ? undefined : onClose);

  const categories = [
    { id: "all", label: "전체", icon: IconSparkles },
    { id: "travel", label: "여행", icon: IconCompass },
    { id: "camping", label: "캠핑/차박", icon: IconTent },
    { id: "baby", label: "육아", icon: IconBabyCarriage },
    { id: "business", label: "출장/업무", icon: IconBriefcase },
    { id: "leisure", label: "휴양/운동", icon: IconSwimming },
  ];

  const allTemplates = useMemo(() => {
    return [...userRegisteredTemplates, ...PRESET_PACK_TEMPLATES];
  }, []);

  const filteredTemplates = useMemo(() => {
    if (selectedCategory === "all") return allTemplates;
    return allTemplates.filter((t) => t.category === selectedCategory);
  }, [selectedCategory, allTemplates]);

  const handleImport = (template: PresetPackTemplate) => {
    const generateUid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newPack: Pack = {
      id: generateUid(),
      name: template.name,
      color: template.color ?? "blue",
      savedAsLibraryPack: true,
      items: template.items.map((item) => ({
        id: generateUid(),
        type: item.type,
        text: item.text,
        checked: false,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onImportToLibrary(newPack);
    setImportedSet((prev) => new Set(prev).add(template.id));
    show(`'${template.name}'을 팩 보관함에 추가했어요!`);
  };

  const handleRegisterMyPack = async (pack: Pack) => {
    setIsInspecting(true);
    try {
      const idToken = user ? await user.getIdToken() : "";
      const res = await fetch("/api/inspect-template", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: pack.name,
          items: pack.items.map((i) => i.text),
          nickname: profile?.nickname ?? "사용자",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.safe) {
        show(data.reason || "부적절하거나 유해한 내용이 포함되어 등록할 수 없어요.");
        return;
      }

      registerPackAsTemplate(pack);
      setActiveTab("gallery");
      show(`'${pack.name}' 팩을 템플릿 갤러리에 공유 등록했어요!`);
    } catch (err) {
      console.error("[팩인백] 템플릿 심사 중 오류:", err);
      show("템플릿 심사 중 오류가 발생했어요.");
    } finally {
      setIsInspecting(false);
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center p-3 md:p-4"
        style={{ zIndex: resolvedZIndex, background: "rgba(0,0,0,0.5)" }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex flex-col w-full max-w-2xl max-h-[85vh] rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden"
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10">
                <IconSparkles size={18} color="var(--accent)" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold">추천 팩 템플릿 갤러리</h3>
                <p className="text-[12px] text-text-muted">검증된 짐싸기 팩을 불러오거나 내 팩을 템플릿으로 등록하세요</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/5" aria-label="닫기">
              <IconX size={18} stroke={1.75} color="var(--text-muted)" />
            </button>
          </div>

          {/* 탭 네비게이션: 갤러리 둘러보기 vs 내 팩 등록하기 */}
          <div className="flex border-b border-border bg-surface shrink-0 px-4 pt-2 gap-4">
            <button
              onClick={() => setActiveTab("gallery")}
              className="pb-2 text-[13px] font-semibold border-b-2 transition-all"
              style={{
                borderColor: activeTab === "gallery" ? "var(--accent)" : "transparent",
                color: activeTab === "gallery" ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              템플릿 둘러보기
            </button>
            <button
              onClick={() => setActiveTab("myPacks")}
              className="pb-2 text-[13px] font-semibold border-b-2 transition-all flex items-center gap-1"
              style={{
                borderColor: activeTab === "myPacks" ? "var(--accent)" : "transparent",
                color: activeTab === "myPacks" ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              <IconPlus size={14} />
              <span>내 팩 템플릿 등록</span>
            </button>
          </div>

          {activeTab === "gallery" ? (
            <>
              {/* 카테고리 칩 필터 */}
              <div className="flex items-center gap-1.5 px-4 py-2.5 overflow-x-auto scrollbar-none border-b border-border bg-surface-2 shrink-0">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  const active = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-all"
                      style={{
                        background: active ? "var(--accent)" : "var(--surface)",
                        color: active ? "#fff" : "var(--text-secondary)",
                        border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
                      }}
                    >
                      <Icon size={14} stroke={1.75} />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* 템플릿 목록 */}
              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredTemplates.map((template) => {
                  const isImported = importedSet.has(template.id);
                  return (
                    <div
                      key={template.id}
                      className="flex flex-col justify-between p-3.5 rounded-xl border border-border bg-surface hover:border-accent/40 transition-all shadow-sm"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <PackColorDot colorId={template.color} onChange={() => {}} />
                            <span className="text-[14px] font-semibold truncate">{template.name}</span>
                          </div>
                          <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-surface-2 text-text-muted">
                            {template.categoryLabel}
                          </span>
                        </div>
                        <p className="text-[12px] text-text-muted mb-2.5 line-clamp-1">{template.description}</p>

                        <div className="flex flex-col gap-1 mb-3 bg-surface-2/60 p-2 rounded-lg">
                          {template.items.slice(0, 4).map((item, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-[12px] text-text-secondary">
                              <span className="w-1.5 h-1.5 rounded-full bg-accent/60 shrink-0" />
                              <span className="truncate">{item.text}</span>
                            </div>
                          ))}
                          {template.items.length > 4 && (
                            <span className="text-[11px] text-text-muted pl-3">
                              외 {template.items.length - 4}개 항목 더보기
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleImport(template)}
                        disabled={isImported}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-medium transition-all"
                        style={{
                          background: isImported ? "var(--surface-2)" : "var(--accent)",
                          color: isImported ? "var(--text-muted)" : "#fff",
                        }}
                      >
                        {isImported ? (
                          <>
                            <IconCheck size={15} stroke={2} />
                            <span>보관함에 담김</span>
                          </>
                        ) : (
                          <>
                            <IconDownload size={15} stroke={2} />
                            <span>내 팩 보관함으로 가져오기</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* 내 팩을 템플릿 갤러리에 등록하는 탭 */
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              <p className="text-[13px] text-text-muted">
                내가 만든 팩 보관함 목록 중 템플릿 갤러리에 공유하고 싶은 팩을 선택하세요:
              </p>
              {userPacks.filter((p) => p.type !== "folder").length === 0 ? (
                <div className="py-12 text-center text-[13px] text-text-muted">
                  아직 보관함에 만든 팩이 없어요. 팩을 새로 만든 후 템플릿으로 공유해보세요!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {userPacks
                    .filter((p) => p.type !== "folder")
                    .map((pack) => (
                      <div
                        key={pack.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface hover:border-accent/40"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <PackColorDot colorId={pack.color} onChange={() => {}} />
                          <div className="min-w-0 flex-1">
                            <h4 className="text-[13.5px] font-medium truncate">{pack.name}</h4>
                            <p className="text-[11.5px] text-text-muted truncate">
                              항목 {pack.items.length}개
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRegisterMyPack(pack)}
                          className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-accent text-white"
                        >
                          템플릿 공유
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isInspecting && (
        <div
          className="fixed inset-0 flex flex-col items-center justify-center gap-3 p-4"
          style={{ zIndex: resolvedZIndex + 5, background: "rgba(0,0,0,0.65)" }}
        >
          <IconLoader2 size={36} className="animate-spin text-accent" />
          <p className="text-[14px] font-medium text-white">AI가 템플릿의 안전성을 심사 중이에요...</p>
        </div>
      )}
    </Portal>
  );
}
