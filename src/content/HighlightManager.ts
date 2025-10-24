/**
 * ハイライト管理ロジック
 */

import { Highlight, Settings } from '../shared/types';
import { StorageManager } from '../shared/storage';
import { HighlightComponent } from './HighlightComponent';

export class HighlightManager {
  private highlights: Map<string, HighlightComponent> = new Map();
  private settings: Settings;
  private currentUrl: string;

  constructor() {
    this.currentUrl = window.location.href;
    this.settings = {} as Settings;
    this.init();
  }

  /**
   * 初期化
   */
  private async init(): Promise<void> {
    try {
      // 設定を読み込み
      this.settings = await StorageManager.getSettings();

      // 機能が無効な場合は何もしない
      if (!this.settings.enabled) {
        return;
      }

      // 保存されているハイライトを読み込み
      await this.loadHighlights();

      // メッセージリスナーを設定
      this.setupMessageListener();

      console.log('HighlightManager initialized');
    } catch (error) {
      console.error('Failed to initialize HighlightManager:', error);
    }
  }

  /**
   * 保存されているハイライトを読み込み
   */
  private async loadHighlights(): Promise<void> {
    try {
      const highlights = await StorageManager.getHighlightsForUrl(
        this.currentUrl,
        this.settings
      );

      let restored = 0;
      let failed = 0;

      highlights.forEach(highlight => {
        const component = new HighlightComponent(highlight, this.deleteHighlight);
        if (component.restore()) {
          this.highlights.set(highlight.id, component);
          restored++;
        } else {
          // 復元に失敗したハイライトは削除
          this.deleteHighlight(highlight.id);
          failed++;
        }
      });

      console.log(
        `Loaded highlights for ${this.currentUrl}: ${restored} restored, ${failed} failed`
      );
    } catch (error) {
      console.error('Failed to load highlights:', error);
    }
  }

  /**
   * URL変更時にハイライトを再読み込み
   */
  private async handleUrlChange(newUrl: string): Promise<void> {
    if (!newUrl || newUrl === this.currentUrl) {
      return;
    }

    console.log(`HighlightManager: URL changed ${this.currentUrl} -> ${newUrl}`);

    this.highlights.forEach(component => component.destroy());
    this.highlights.clear();

    this.currentUrl = newUrl;

    if (!this.settings.enabled) {
      return;
    }

    try {
      await this.loadHighlights();
    } catch (error) {
      console.error('Failed to reload highlights after URL change:', error);
    }
  }

  /**
   * 新しいハイライトを作成
   */
  createHighlight = (color: string): void => {
    const component = HighlightComponent.createFromSelection(
      this.currentUrl,
      color,
      this.deleteHighlight
    );

    if (component) {
      const highlight = component.getHighlight();
      this.highlights.set(highlight.id, component);
      this.saveHighlight(highlight);
      console.log('Highlight created:', highlight.id);
    } else {
      console.warn('Failed to create highlight from selection');
    }
  };

  /**
   * ハイライトを保存
   */
  private saveHighlight = async (highlight: Highlight): Promise<void> => {
    try {
      console.log('Saving highlight:', highlight.id);
      await StorageManager.saveHighlight(highlight, this.settings);
      console.log('Highlight saved successfully:', highlight.id);
    } catch (error) {
      console.error('Failed to save highlight:', error);
    }
  };

  /**
   * ハイライトを削除
   */
  deleteHighlight = async (highlightId: string): Promise<void> => {
    try {
      const component = this.highlights.get(highlightId);
      if (component) {
        component.delete();
        this.highlights.delete(highlightId);
      }

      await StorageManager.deleteHighlight(
        highlightId,
        this.currentUrl,
        this.settings
      );
      console.log('Highlight deleted:', highlightId);
    } catch (error) {
      console.error('Failed to delete highlight:', error);
    }
  };

  /**
   * すべてのハイライトを削除
   */
  deleteAllHighlights = async (): Promise<void> => {
    try {
      this.highlights.forEach(component => component.delete());
      this.highlights.clear();

      await StorageManager.deleteAllHighlightsForUrl(
        this.currentUrl,
        this.settings
      );
      console.log('All highlights deleted for current URL');
    } catch (error) {
      console.error('Failed to delete all highlights:', error);
    }
  };

  /**
   * メッセージリスナーを設定
   */
  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      switch (message.type) {
        case 'CREATE_HIGHLIGHT':
          this.createHighlight(message.color || 'rgba(255, 255, 0, 0.3)');
          sendResponse({ success: true });
          break;

        case 'DELETE_ALL_HIGHLIGHTS':
          this.deleteAllHighlights();
          sendResponse({ success: true });
          break;

        case 'GET_HIGHLIGHTS_COUNT':
          sendResponse({ count: this.highlights.size });
          break;

        case 'SPA_URL_CHANGED':
          if (typeof message.url === 'string') {
            this.handleUrlChange(message.url).catch(error => {
              console.error('Failed to handle SPA URL change in HighlightManager:', error);
            });
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Invalid URL' });
          }
          break;

        default:
          // 他のマネージャーにも処理を渡す
          return false;
      }

      return true;
    });
  }

  /**
   * 全ハイライトを取得
   */
  getAllHighlights(): Highlight[] {
    return Array.from(this.highlights.values()).map(component =>
      component.getHighlight()
    );
  }

  /**
   * ハイライト数を取得
   */
  getHighlightsCount(): number {
    return this.highlights.size;
  }
}
