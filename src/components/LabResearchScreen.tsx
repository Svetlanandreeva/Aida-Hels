import React from 'react';
import { FileText, Upload, AlertCircle, Trash2, ChevronRight, RefreshCw } from 'lucide-react';
import { MedicalDocument } from '../types';
import { deduplicateMarkers } from '../utils/markerUtils';

type DocFilter = 'all' | 'lab' | 'ultrasound' | 'instrumental' | 'consultations';

interface LabResearchScreenProps {
  documents: MedicalDocument[];
  setDocuments: React.Dispatch<React.SetStateAction<MedicalDocument[]>>;
  docFilter: DocFilter;
  setDocFilter: (value: DocFilter) => void;
  isUploading: boolean;
  uploadProgress: number;
  uploadStatusStep: string;
  uploadError: string | null;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRetryUpload: () => void;
}

const filters: Array<{ id: DocFilter; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'lab', label: 'Анализы' },
  { id: 'ultrasound', label: 'УЗИ' },
  { id: 'instrumental', label: 'Исследования' },
  { id: 'consultations', label: 'Заключения' },
];

const statusClass = (status?: string) => {
  if (status === 'Выше' || status === 'Ниже') return 'aida-lab-status aida-lab-status--attention';
  if (status === 'Внимание') return 'aida-lab-status aida-lab-status--warning';
  return 'aida-lab-status aida-lab-status--normal';
};

const getFriendlyUploadStatus = (internalStep: string, progress: number) => {
  const normalized = internalStep.toLowerCase();
  if (normalized.includes('распозн') || normalized.includes('ocr')) return 'Считываем данные из документа…';
  if (normalized.includes('анализ') || normalized.includes('маркер') || normalized.includes('нормал')) return 'Разбираем показатели…';
  if (normalized.includes('готов') || progress >= 90) return 'Почти готово…';
  if (progress >= 45) return 'Обрабатываем медицинские данные…';
  return 'Подготавливаем документ…';
};

export const LabResearchScreen: React.FC<LabResearchScreenProps> = ({
  documents,
  setDocuments,
  docFilter,
  setDocFilter,
  isUploading,
  uploadProgress,
  uploadStatusStep,
  uploadError,
  handleFileUpload,
  handleRetryUpload,
}) => {
  const visibleDocuments = documents.filter((doc) => docFilter === 'all' || doc.category === docFilter);
  const friendlyUploadStatus = getFriendlyUploadStatus(uploadStatusStep, uploadProgress);

  const totals = React.useMemo(() => {
    const markers = documents.flatMap((doc) =>
      deduplicateMarkers(doc.allMarkers && doc.allMarkers.length > 0 ? doc.allMarkers : doc.deviations)
    );
    const attention = markers.filter((marker: any) => marker.status && marker.status !== 'В норме').length;
    return { documents: documents.length, markers: markers.length, attention };
  }, [documents]);

  return (
    <section className="aida-lab-screen">
      <div className="aida-lab-hero">
        <div>
          <span className="aida-lab-eyebrow">Медицинские данные</span>
          <h1>Анализы и исследования</h1>
          <p>
            Храните результаты в одном месте. Аида показывает только данные из загруженных документов и отдельно отмечает показатели, которые требуют внимания.
          </p>
        </div>
        <label className="aida-lab-upload-button">
          <Upload size={17} />
          <span>Добавить документ</span>
          <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} hidden />
        </label>
      </div>

      <div className="aida-lab-summary-grid">
        <div className="aida-lab-summary-card">
          <span>Документы</span>
          <strong>{totals.documents}</strong>
          <small>{totals.documents ? 'сохранено в истории' : 'пока нет данных'}</small>
        </div>
        <div className="aida-lab-summary-card">
          <span>Показатели</span>
          <strong>{totals.markers}</strong>
          <small>{totals.markers ? 'распознано из документов' : 'появятся после загрузки'}</small>
        </div>
        <div className="aida-lab-summary-card aida-lab-summary-card--accent">
          <span>Требуют внимания</span>
          <strong>{totals.attention}</strong>
          <small>{totals.markers ? 'по сохранённым данным' : 'недостаточно данных'}</small>
        </div>
      </div>

      {(isUploading || uploadError) && (
        <div className={`aida-lab-upload-state ${uploadError ? 'is-error' : ''}`}>
          <div className="aida-lab-upload-state__icon">
            {uploadError ? <AlertCircle size={20} /> : <RefreshCw size={20} className="aida-spin" />}
          </div>
          <div className="aida-lab-upload-state__copy">
            <strong>{uploadError ? 'Не удалось обработать документ' : 'Обрабатываем документ'}</strong>
            <span>{uploadError ? 'Попробуйте загрузить файл ещё раз. Если ошибка повторится, выберите другой файл.' : friendlyUploadStatus}</span>
            {!uploadError && (
              <div className="aida-lab-progress"><i style={{ width: `${Math.max(4, uploadProgress)}%` }} /></div>
            )}
          </div>
          {uploadError && (
            <button type="button" onClick={handleRetryUpload}>Повторить</button>
          )}
        </div>
      )}

      <div className="aida-lab-toolbar">
        <div className="aida-lab-tabs" role="tablist" aria-label="Фильтр документов">
          {filters.map((filter) => (
            <button
              type="button"
              key={filter.id}
              className={docFilter === filter.id ? 'is-active' : ''}
              onClick={() => setDocFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <span className="aida-lab-count">{visibleDocuments.length} {visibleDocuments.length === 1 ? 'документ' : 'документов'}</span>
      </div>

      {visibleDocuments.length === 0 ? (
        <div className="aida-lab-empty">
          <div className="aida-lab-empty__icon"><FileText size={26} /></div>
          <h2>{documents.length ? 'В этой категории пока ничего нет' : 'Добавьте первый медицинский документ'}</h2>
          <p>
            {documents.length
              ? 'Выберите другой раздел или загрузите новый файл.'
              : 'Подойдут фото или PDF. Пока документа нет, Аида не будет показывать медицинские значения или делать выводы.'}
          </p>
          <label className="aida-lab-upload-button aida-lab-upload-button--secondary">
            <Upload size={16} />
            <span>Выбрать файл</span>
            <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} hidden />
          </label>
        </div>
      ) : (
        <div className="aida-lab-documents">
          {visibleDocuments.map((doc) => {
            const markers = deduplicateMarkers(
              doc.allMarkers && doc.allMarkers.length > 0 ? doc.allMarkers : doc.deviations
            ) as Array<{ marker: string; value?: string; norm?: string; status?: string; explanation?: string }>;
            const attentionMarkers = markers.filter((marker) => marker.status && marker.status !== 'В норме');

            return (
              <article className="aida-lab-document" key={doc.id}>
                <header className="aida-lab-document__header">
                  <div className="aida-lab-document__title">
                    <span>{doc.categoryLabel}</span>
                    <h2>{doc.title}</h2>
                    <small>{doc.date || 'Дата не указана'}</small>
                  </div>
                  <button
                    className="aida-lab-icon-button"
                    type="button"
                    aria-label="Удалить документ"
                    onClick={() => setDocuments((prev) => prev.filter((item) => item.id !== doc.id))}
                  >
                    <Trash2 size={17} />
                  </button>
                </header>

                <div className="aida-lab-document__body">
                  <div className="aida-lab-insight">
                    <span>Итог Аиды</span>
                    <p>{doc.summary || 'Краткий итог появится после обработки документа.'}</p>
                  </div>

                  <div className="aida-lab-marker-summary">
                    <div>
                      <strong>{markers.length}</strong>
                      <span>показателей</span>
                    </div>
                    <div>
                      <strong>{attentionMarkers.length}</strong>
                      <span>требуют внимания</span>
                    </div>
                  </div>

                  {markers.length > 0 ? (
                    <div className="aida-lab-markers">
                      <div className="aida-lab-markers__head">
                        <h3>Показатели</h3>
                        <span>Значения из документа</span>
                      </div>
                      <div className="aida-lab-marker-list">
                        {markers.map((marker, index) => (
                          <div className="aida-lab-marker-row" key={`${marker.marker}-${index}`}>
                            <div className="aida-lab-marker-row__name">
                              <strong>{marker.marker}</strong>
                              {marker.norm && <small>Референс: {marker.norm}</small>}
                            </div>
                            <div className="aida-lab-marker-row__value">{marker.value || '—'}</div>
                            <span className={statusClass(marker.status)}>{marker.status || 'Нет статуса'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="aida-lab-no-markers">В документе пока нет распознанных показателей.</div>
                  )}

                  {doc.recommendations.length > 0 && (
                    <div className="aida-lab-next-steps">
                      <h3>Что можно сделать дальше</h3>
                      {doc.recommendations.map((item, index) => (
                        <div key={`${doc.id}-rec-${index}`} className="aida-lab-next-step">
                          <ChevronRight size={16} />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default LabResearchScreen;
