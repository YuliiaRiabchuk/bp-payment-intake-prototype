/**
 * Довідник статей витрат — приїжджає з 1С плоским списком і лежить тут рівно
 * таким, яким приходить: дві мови впереміш, дублі, десяток позицій доставки на
 * кожну машину. Склад ми не міняємо — він живе в 1С і чиститься там (BRIEF §5).
 *
 * Групи — НАША мапа поверх плоского списку, не поле довідника. У 1С такого
 * реквізиту немає, тож групування є вимогою до 1С, а не фактом: або новий
 * реквізит на їхньому боці, або ця таблиця відповідності, яку хтось веде.
 * У пікері це позначено як пропозиція, щоб межа між чинним і новим була видна.
 *
 * Дублі лишаються навмисно. У групі вони стають сусідами і саме так найкраще
 * доводять потребу почистити довідник: групування дублі не лікує.
 */

export type ArticleGroup = 'delivery' | 'damage' | 'services' | 'accruals' | 'other'

export interface ExpenseArticle {
  /** Ключ рядка. Дублі за назвою мають різні ключі — як у 1С. */
  id: string
  name: string
  group: ArticleGroup
}

/**
 * Ставка ПДВ живе на СТАТТІ, а не одним прапорцем на всю оренду.
 *
 * Всередині однієї оренди частина позицій іде без ПДВ, частина з ПДВ — це не
 * виняток, а норма: штрафні санкції не є постачанням і ПДВ не оподатковуються,
 * решта статей іде за ставкою організації-отримувача. Прапорець на весь
 * документ такого не вміє, і саме тому модель повторює 1С: ставка в рядку.
 *
 * Дефолт проставляє система. Менеджер бачить ставку, але думає про неї лише
 * тоді, коли треба перевизначити — тобто рідко.
 */
export type VatRate = 0 | 20

/** Групи, які за замовчуванням ідуть без ПДВ. Пошкодження і штрафи — санкції. */
const ZERO_VAT_GROUPS: ArticleGroup[] = ['damage']

export function defaultVatFor(article: ExpenseArticle | undefined): VatRate {
  if (!article) return 20
  return ZERO_VAT_GROUPS.includes(article.group) ? 0 : 20
}

export const ARTICLE_GROUP_LABEL: Record<ArticleGroup, string> = {
  delivery: 'Доставка і логістика',
  damage: 'Пошкодження і забруднення',
  services: 'Послуги і виїзди',
  accruals: 'Донарахування і перерахунки',
  other: 'Інше',
}

/** Порядок груп у пікері — від найчастішого до службового. */
export const ARTICLE_GROUP_ORDER: ArticleGroup[] = [
  'delivery',
  'damage',
  'services',
  'accruals',
  'other',
]

export const EXPENSE_ARTICLES: ExpenseArticle[] = [
  { id: 'a01', name: 'Доставка', group: 'delivery' },
  { id: 'a02', name: 'ДоставкаDoblo', group: 'delivery' },
  { id: 'a03', name: 'ДоставкаDOBLO 5T', group: 'delivery' },
  { id: 'a04', name: 'ДоставкаFordTransit AA0385PM', group: 'delivery' },
  { id: 'a05', name: 'ДоставкаFordTransit AA7712BX', group: 'delivery' },
  { id: 'a06', name: 'ДоставкаMercedes Sprinter', group: 'delivery' },
  { id: 'a07', name: 'ДоставкаRenault Master', group: 'delivery' },
  { id: 'a08', name: 'Внеплановая Выгрузка/Загрузка', group: 'delivery' },
  { id: 'a09', name: 'Погрузка, разгрузка', group: 'delivery' },
  { id: 'a10', name: 'Повернення на інший склад', group: 'delivery' },

  { id: 'a11', name: 'Забруднення', group: 'damage' },
  { id: 'a12', name: 'Забруднення', group: 'damage' },
  { id: 'a13', name: 'Забруднення механіки', group: 'damage' },
  { id: 'a14', name: 'Забруднення Підіймачі', group: 'damage' },
  { id: 'a15', name: 'Забруднення риштування, вишки', group: 'damage' },
  { id: 'a16', name: 'Забруднення (сторонні організації)', group: 'damage' },
  { id: 'a17', name: 'Пошкодження інструменту', group: 'damage' },
  { id: 'a18', name: 'Пошкодження інструменту', group: 'damage' },
  { id: 'a19', name: 'Повреждение элементов лесов и вышек', group: 'damage' },
  { id: 'a20', name: 'Поломка мелкощитовой опалубки', group: 'damage' },
  { id: 'a21', name: 'Поломка элементов леса/вышки', group: 'damage' },
  { id: 'a22', name: 'Чистка обладнання', group: 'damage' },
  { id: 'a23', name: 'Знос диску', group: 'damage' },
  { id: 'a24', name: 'Утеря обладнання', group: 'damage' },
  { id: 'a25', name: 'Поверненення обладнання в неповному обсязі', group: 'damage' },

  { id: 'a26', name: 'послуги', group: 'services' },
  { id: 'a27', name: 'Выезд мастера на обьект', group: 'services' },
  { id: 'a28', name: 'Хибний виклик', group: 'services' },
  { id: 'a29', name: 'Заміна фільтра', group: 'services' },
  { id: 'a30', name: 'Ремонт обладнання', group: 'services' },
  { id: 'a31', name: 'Витратні матеріали', group: 'services' },

  { id: 'a32', name: 'Донарахування до мінімалки', group: 'accruals' },
  { id: 'a33', name: 'Донарахування до мінімалки', group: 'accruals' },
  { id: 'a34', name: 'Системне донарахування', group: 'accruals' },
  { id: 'a35', name: 'Системне донарахування', group: 'accruals' },
  { id: 'a36', name: 'За вихідний', group: 'accruals' },
  { id: 'a37', name: 'Прострочення повернення', group: 'accruals' },
  { id: 'a38', name: 'Банковський %', group: 'accruals' },
  { id: 'a39', name: 'Банковський %', group: 'accruals' },
  { id: 'a40', name: 'Возврат задним числом', group: 'accruals' },
  { id: 'a41', name: 'Возврат задним числом', group: 'accruals' },

  { id: 'a42', name: 'Порушення умов договору', group: 'other' },
  { id: 'a43', name: 'Ошибка менеджера', group: 'other' },
  { id: 'a44', name: 'Помилка в роботі програми', group: 'other' },
  { id: 'a45', name: 'Неопознано (до выяснения)', group: 'other' },
  { id: 'a46', name: 'Списання', group: 'other' },
]

export const ARTICLE_BY_ID = new Map(EXPENSE_ARTICLES.map((a) => [a.id, a]))

/**
 * «Часті» — закріплені зверху. У проді це частотність конкретного менеджера;
 * у прототипі фіксований список, щоб кадр був відтворюваний.
 */
export const FREQUENT_ARTICLE_IDS = ['a01', 'a17', 'a26', 'a11', 'a28']

/**
 * Підказка за контекстом етапу — не фільтр, а порядок: ці статті спливають
 * під власним заголовком. Решта довідника нікуди не дівається.
 */
export const ARTICLE_HINT_BY_STAGE: Record<
  string,
  { note: string; ids: string[] }
> = {
  draft: { note: 'На оформленні це майже завжди доставка', ids: ['a01', 'a09'] },
  payment: {
    note: 'На розрахунку це донарахування або банківський відсоток',
    ids: ['a32', 'a38', 'a36'],
  },
  handover: {
    note: 'На видачі це доставка або довидача розхідника',
    ids: ['a01', 'a31', 'a09'],
  },
  active: {
    note: 'Поки оренда триває це виїзд, доставка або пошкодження в роботі',
    ids: ['a28', 'a01', 'a27', 'a17'],
  },
  closing: {
    note: 'На прийманні це забруднення, недостача або чистка',
    ids: ['a11', 'a22', 'a25', 'a17'],
  },
}

/**
 * Стаття, за якою ховається нерозвʼязана розвилка §7.7: довидача розхідника
 * посеред оренди. Частина відділень оформлює її нарахуванням, керівництво
 * наполягає на другій оренді. Прототип показує обидва прочитання і не вирішує.
 */
export const DISPUTED_ARTICLE_IDS = ['a31']
