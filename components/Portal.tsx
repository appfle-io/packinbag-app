"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// 화면 전환에 transform(translateX)을 쓰는 탭 구조 안에서 fixed 포지션 요소를
// 열면, 브라우저가 그 fixed 요소의 기준을 뷰포트가 아니라 transform이 걸린
// 조상으로 잡아버려서 위치가 어긋나는 문제가 있다. (탭에 따라 화면 밖으로
// 밀려나서 안 보이기도 함) 모달류는 항상 이 Portal로 감싸서 body 최상단에
// 그려지도록 해서 이 문제를 원천적으로 피한다.
export default function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 포탈은 document.body가 있는 클라이언트에서만 렌더링할 수 있어서 마운트 여부를
    // 표준적인 방식(mounted 플래그)으로 추적한다. 외부 시스템(DOM) 가용 여부를
    // React 상태에 반영하는 의도된 처리라 set-state-in-effect 규칙은 비활성화한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}
