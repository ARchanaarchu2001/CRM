import { useEffect, useMemo, useRef, useState } from 'react';

const MIN_COLUMN_WIDTH = 56;

export const useSheetLayout = ({
  storageKey,
  orderedColumnKeys,
  defaultFixedColumnKeys = ['contact'],
  defaultColumnWidths = {},
}) => {
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isTableEditMode, setIsTableEditMode] = useState(false);
  const [fixedColumnKeys, setFixedColumnKeys] = useState(defaultFixedColumnKeys);
  const [columnWidths, setColumnWidths] = useState(defaultColumnWidths);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  const tableContainerRef = useRef(null);
  const tableElementRef = useRef(null);
  const bottomScrollbarRef = useRef(null);
  const isSyncingScrollRef = useRef(false);
  const resizeStateRef = useRef(null);
  const skipNextWidthSaveRef = useRef(false);
  const skipNextFixedSaveRef = useRef(false);

  const fixedKey = `${storageKey}:fixed`;
  const widthKey = `${storageKey}:widths`;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    skipNextFixedSaveRef.current = true;
    skipNextWidthSaveRef.current = true;
    try {
      const storedFixed = JSON.parse(window.localStorage.getItem(fixedKey) || 'null');
      const storedWidths = JSON.parse(window.localStorage.getItem(widthKey) || 'null');
      if (Array.isArray(storedFixed) && storedFixed.length) {
        setFixedColumnKeys(storedFixed);
      }
      if (storedWidths && typeof storedWidths === 'object') {
        setColumnWidths((current) => ({
          ...current,
          ...storedWidths,
        }));
      }
    } catch {}
  }, [fixedKey, widthKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (skipNextFixedSaveRef.current) {
      skipNextFixedSaveRef.current = false;
      return;
    }
    window.localStorage.setItem(fixedKey, JSON.stringify(fixedColumnKeys));
  }, [fixedColumnKeys, fixedKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (skipNextWidthSaveRef.current) {
      skipNextWidthSaveRef.current = false;
      return;
    }
    window.localStorage.setItem(widthKey, JSON.stringify(columnWidths));
  }, [columnWidths, widthKey]);

  const pinnedColumnKeys = useMemo(
    () => orderedColumnKeys.filter((key) => fixedColumnKeys.includes(key)),
    [fixedColumnKeys, orderedColumnKeys]
  );

  const orderedDisplayColumnKeys = useMemo(() => {
    const pinnedAfterFirst = pinnedColumnKeys.filter((key) => key !== orderedColumnKeys[0]);
    const remaining = orderedColumnKeys.filter(
      (key) => key !== orderedColumnKeys[0] && !pinnedAfterFirst.includes(key)
    );
    return [orderedColumnKeys[0], ...pinnedAfterFirst, ...remaining];
  }, [orderedColumnKeys, pinnedColumnKeys]);

  const getColumnWidth = (columnKey) =>
    Math.max(columnWidths[columnKey] || defaultColumnWidths[columnKey] || 160, MIN_COLUMN_WIDTH);

  const getPinnedOffset = (columnKey) =>
    pinnedColumnKeys
      .slice(0, pinnedColumnKeys.indexOf(columnKey))
      .reduce((total, key) => total + getColumnWidth(key), 0);

  const isFixedColumn = (columnKey) => fixedColumnKeys.includes(columnKey);

  const getColumnStyle = (columnKey) => {
    const width = `${getColumnWidth(columnKey)}px`;
    return isFixedColumn(columnKey)
      ? {
          minWidth: width,
          width,
          maxWidth: width,
          left: `${getPinnedOffset(columnKey)}px`,
        }
      : {
          minWidth: width,
          width,
          maxWidth: width,
        };
  };

  const getPinnedClasses = (columnKey, baseClassName, bgClassName, zIndexClassName) => {
    if (!isFixedColumn(columnKey)) {
      return `${baseClassName} ${bgClassName}`;
    }

    return `sticky ${zIndexClassName} ${baseClassName} ${bgClassName} shadow-[8px_0_12px_-10px_rgba(15,23,42,0.34)]`;
  };

  const startColumnResize = (event, columnKey) => {
    event.preventDefault();
    event.stopPropagation();
    resizeStateRef.current = {
      columnKey,
      startX: event.clientX,
      startWidth: getColumnWidth(columnKey),
    };
    if (document.body) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }
  };

  useEffect(() => {
    const handlePointerMove = (event) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) return;

      const nextWidth = Math.max(
        resizeState.startWidth + (event.clientX - resizeState.startX),
        MIN_COLUMN_WIDTH
      );
      setColumnWidths((current) => ({
        ...current,
        [resizeState.columnKey]: nextWidth,
      }));
    };

    const stopResize = () => {
      resizeStateRef.current = null;
      if (document.body) {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
    };
  }, []);

  useEffect(() => {
    const container = tableContainerRef.current;
    const bottomScrollbar = bottomScrollbarRef.current;
    const tableElement = tableElementRef.current;
    if (!container || !bottomScrollbar || !tableElement) return undefined;

    const updateScrollState = () => {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(container.scrollLeft + container.clientWidth < container.scrollWidth - 1);
      setTableScrollWidth(tableElement.scrollWidth);
    };

    const syncFromTable = () => {
      if (isSyncingScrollRef.current) return;
      isSyncingScrollRef.current = true;
      bottomScrollbar.scrollLeft = container.scrollLeft;
      updateScrollState();
      window.requestAnimationFrame(() => {
        isSyncingScrollRef.current = false;
      });
    };

    const syncFromBottom = () => {
      if (isSyncingScrollRef.current) return;
      isSyncingScrollRef.current = true;
      container.scrollLeft = bottomScrollbar.scrollLeft;
      updateScrollState();
      window.requestAnimationFrame(() => {
        isSyncingScrollRef.current = false;
      });
    };

    updateScrollState();
    bottomScrollbar.scrollLeft = container.scrollLeft;
    container.addEventListener('scroll', syncFromTable);
    bottomScrollbar.addEventListener('scroll', syncFromBottom);
    window.addEventListener('resize', updateScrollState);

    return () => {
      container.removeEventListener('scroll', syncFromTable);
      bottomScrollbar.removeEventListener('scroll', syncFromBottom);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [columnWidths, orderedDisplayColumnKeys]);

  return {
    isFocusMode,
    setIsFocusMode,
    isTableEditMode,
    setIsTableEditMode,
    fixedColumnKeys,
    setFixedColumnKeys,
    columnWidths,
    canScrollLeft,
    canScrollRight,
    tableScrollWidth,
    tableContainerRef,
    tableElementRef,
    bottomScrollbarRef,
    orderedDisplayColumnKeys,
    isFixedColumn,
    getColumnStyle,
    getPinnedClasses,
    startColumnResize,
  };
};
