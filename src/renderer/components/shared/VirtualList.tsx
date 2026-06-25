import React, { ComponentType } from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  height: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}

export function VirtualList<T>({ items, itemHeight, height, renderItem, className }: VirtualListProps<T>) {
  const Row = ({ index, style }: ListChildComponentProps) => (
    <div style={style}>{renderItem(items[index], index)}</div>
  );

  return (
    <FixedSizeList
      height={height}
      width="100%"
      itemCount={items.length}
      itemSize={itemHeight}
      className={className}
    >
      {Row}
    </FixedSizeList>
  );
}
