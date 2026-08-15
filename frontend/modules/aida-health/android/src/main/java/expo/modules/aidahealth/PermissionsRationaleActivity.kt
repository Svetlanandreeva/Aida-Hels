package expo.modules.aidahealth

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.text.method.LinkMovementMethod
import android.view.ViewGroup
import android.widget.ScrollView
import android.widget.TextView

class PermissionsRationaleActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val density = resources.displayMetrics.density
    val padding = (24 * density).toInt()

    val text = TextView(this).apply {
      setTextColor(Color.rgb(27, 27, 29))
      textSize = 16f
      setLineSpacing(0f, 1.25f)
      setPadding(padding, padding, padding, padding)
      movementMethod = LinkMovementMethod.getInstance()
      this.text = """
        Аида и данные Health Connect

        Аида запрашивает только чтение тех показателей здоровья, которые нужны для вашей персональной картины здоровья: пульс, пульс покоя, вариабельность сердечного ритма, сон, шаги, активные калории, частота дыхания, насыщение крови кислородом и VO₂ max.

        Эти данные используются для отображения динамики и формирования аналитики внутри вашего профиля Аиды. Аида не записывает и не изменяет данные в Health Connect через эту интеграцию.

        Доступ можно отозвать в любой момент в настройках Health Connect. Без вашего разрешения Аида не получает эти показатели.

        Перед публикацией Android-приложения эта информация должна совпадать с политикой конфиденциальности, указанной для Аиды в Google Play.
      """.trimIndent()
    }

    val scroll = ScrollView(this).apply {
      setBackgroundColor(Color.rgb(250, 250, 249))
      addView(
        text,
        ViewGroup.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.WRAP_CONTENT
        )
      )
    }

    setContentView(scroll)
  }
}
