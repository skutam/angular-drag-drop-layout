import {Component, effect, input, model, output} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {HeightUnit, Unit} from "../../../../drag-drop-layout/src/lib/definitions";

@Component({
  selector: 'app-height-prop-picker',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule
  ],
  templateUrl: './height-prop-picker.component.html',
  styleUrl: './height-prop-picker.component.less'
})
export class HeightPropPickerComponent {
  public disabled = input(false);
  public heightValue = model(0);
  public heightUnit = model<Unit>('px');

  public heightProp = output<HeightUnit>();

  constructor() {
    effect(() => {
      this.heightProp.emit(`${this.heightValue()}${this.heightUnit()}`);
    });
  }
}
