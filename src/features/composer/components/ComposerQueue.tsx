import { useCallback } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { QueuedMessage } from "../../../types";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";
import {
  PopoverMenuItem,
  PopoverSurface,
} from "../../design-system/components/popover/PopoverPrimitives";
import { useMenuController } from "../../app/hooks/useMenuController";

type ComposerQueueProps = {
  queuedMessages: QueuedMessage[];
  pausedReason?: string | null;
  onEditQueued?: (item: QueuedMessage) => void;
  onDeleteQueued?: (id: string) => void;
};

export function ComposerQueue({
  queuedMessages,
  pausedReason = null,
  onEditQueued,
  onDeleteQueued,
}: ComposerQueueProps) {
  const locale = useAppLocale();
  if (queuedMessages.length === 0) {
    return null;
  }

  return (
    <div className="composer-queue">
      <div className="composer-queue-title">{m.composer_queue_title({}, { locale })}</div>
      {pausedReason ? (
        <div className="composer-queue-hint">{pausedReason}</div>
      ) : null}
      <div className="composer-queue-list">
        {queuedMessages.map((item) => (
          <div key={item.id} className="composer-queue-item">
            <span className="composer-queue-text">
              {item.text ||
                (item.images?.length
                  ? item.images.length === 1
                    ? m.composer_queue_image({}, { locale })
                    : m.composer_queue_images({}, { locale })
                  : "")}
              {item.images?.length
                ? ` · ${m.composer_queue_images_count(
                    { value: String(item.images.length) },
                    { locale },
                  )}`
                : ""}
            </span>
            <QueueMenuButton
              item={item}
              onEditQueued={onEditQueued}
              onDeleteQueued={onDeleteQueued}
              locale={locale}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

type QueueMenuButtonProps = {
  item: QueuedMessage;
  onEditQueued?: (item: QueuedMessage) => void;
  onDeleteQueued?: (id: string) => void;
  locale: ReturnType<typeof useAppLocale>;
};

function QueueMenuButton({
  item,
  onEditQueued,
  onDeleteQueued,
  locale,
}: QueueMenuButtonProps) {
  const menu = useMenuController();
  const handleToggleMenu = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      menu.toggle();
    },
    [menu],
  );

  const handleEdit = useCallback(() => {
    menu.close();
    onEditQueued?.(item);
  }, [item, menu, onEditQueued]);

  const handleDelete = useCallback(() => {
    menu.close();
    onDeleteQueued?.(item.id);
  }, [item.id, menu, onDeleteQueued]);

  return (
    <div className="composer-queue-menu-wrap" ref={menu.containerRef}>
      <button
        type="button"
        className={`composer-queue-menu${menu.isOpen ? " is-open" : ""}`}
        onClick={handleToggleMenu}
        aria-label={m.composer_queue_item_menu({}, { locale })}
        aria-haspopup="menu"
        aria-expanded={menu.isOpen}
      >
        ...
      </button>
      {menu.isOpen && (
        <PopoverSurface className="composer-queue-item-popover" role="menu">
          <PopoverMenuItem onClick={handleEdit}>
            {m.action_edit({}, { locale })}
          </PopoverMenuItem>
          <PopoverMenuItem onClick={handleDelete}>
            {m.action_delete({}, { locale })}
          </PopoverMenuItem>
        </PopoverSurface>
      )}
    </div>
  );
}
